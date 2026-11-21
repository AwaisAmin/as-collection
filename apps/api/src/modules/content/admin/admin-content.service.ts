import type { AdminPageDto, AdminPageListItemDto } from '@as/contracts';
import { Injectable } from '@nestjs/common';

import {
  assertFresh,
  conflict,
  lockRow,
  notFound,
  sameMembers,
  type Tx,
} from '../../../common/admin-write.js';
import { uuidv7 } from '../../../common/crypto.js';
import { ValidationFailedException } from '../../../common/http/problem-details.js';
import { formatIssuePath } from '../../../common/http/validation.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { isSectionType, SECTION_SCHEMAS } from '../content.schemas.js';
import { ContentService } from '../content.service.js';
import type {
  CreatePageInput,
  CreateSectionInput,
  MenuItemInput,
  PutMenuInput,
  UpdatePageInput,
  UpdateSectionInput,
} from './admin-content.schemas.js';

/** Pages and menus the storefront depends on: never deleted (the home page never unpublished). */
export const PROTECTED_PAGES: ReadonlySet<string> = new Set(['home']);
export const PROTECTED_MENUS: ReadonlySet<string> = new Set([
  'main',
  'shop-mega',
  'footer',
  'mobile',
]);

const pageNotFound = () => notFound('PAGE_NOT_FOUND', 'Page not found.');
const sectionNotFound = () => notFound('SECTION_NOT_FOUND', 'Section not found.');
const menuNotFound = () => notFound('MENU_NOT_FOUND', 'Menu not found.');

/** Validates section settings with the type's storefront schema; returns the parsed value. */
export function parseSectionSettings(type: string, settings: unknown): Prisma.InputJsonObject {
  if (!isSectionType(type)) {
    throw new ValidationFailedException([
      { path: 'type', message: `Unknown section type "${type}".` },
    ]);
  }
  const parsed = SECTION_SCHEMAS[type].safeParse(settings);
  if (!parsed.success) {
    throw new ValidationFailedException(
      parsed.error.issues.map((issue) => ({
        path: `settings.${formatIssuePath(issue.path)}`,
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

/** Nested menu input → flat rows (parents first) with generated ids and sibling positions. */
export function flattenMenu(menuId: string, items: MenuItemInput[]) {
  const rows: Prisma.MenuItemCreateManyInput[] = [];
  const walk = (list: MenuItemInput[], parentId: string | null) => {
    list.forEach((item, position) => {
      const id = uuidv7();
      rows.push({
        id,
        menuId,
        parentId,
        label: item.label,
        url: item.url,
        openInNewTab: item.openInNewTab,
        isVisible: item.isVisible,
        settings: item.settings ?? undefined,
        position,
      });
      walk(item.children, id);
    });
  };
  walk(items, null);
  return rows;
}

const sectionSelect = {
  id: true,
  type: true,
  settings: true,
  position: true,
  isVisible: true,
  startsAt: true,
  endsAt: true,
  updatedAt: true,
} satisfies Prisma.PageSectionSelect;

/**
 * Pages (ordered sections) and navigation menus. Section settings are validated with the very
 * schemas the storefront parses them with, so a saved section always renders. Every write is
 * audited and refreshes the storefront content cache.
 */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly content: ContentService,
  ) {}

  // ─── Pages ───

  async pages(): Promise<AdminPageListItemDto[]> {
    const rows = await this.prisma.page.findMany({
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        updatedAt: true,
        _count: { select: { sections: true } },
      },
    });
    return rows.map(({ _count, ...p }) => ({
      ...p,
      updatedAt: p.updatedAt.toISOString(),
      sections: _count.sections,
      protected: PROTECTED_PAGES.has(p.slug),
    }));
  }

  /** The page with every section, including hidden and scheduled ones. */
  async page(id: string): Promise<AdminPageDto> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        createdAt: true,
        updatedAt: true,
        sections: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: sectionSelect },
      },
    });
    if (!page) throw pageNotFound();
    const now = new Date();
    return {
      ...page,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      protected: PROTECTED_PAGES.has(page.slug),
      sections: page.sections.map((s) => {
        const valid =
          isSectionType(s.type) && SECTION_SCHEMAS[s.type].safeParse(s.settings).success;
        return {
          ...s,
          settings: (s.settings ?? {}) as Record<string, unknown>,
          startsAt: s.startsAt?.toISOString() ?? null,
          endsAt: s.endsAt?.toISOString() ?? null,
          updatedAt: s.updatedAt.toISOString(),
          /** False: the storefront skips it (e.g. saved before a schema change). */
          valid,
          live:
            valid &&
            s.isVisible &&
            (!s.startsAt || s.startsAt <= now) &&
            (!s.endsAt || s.endsAt > now),
        };
      }),
    };
  }

  async createPage(input: CreatePageInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      if (await tx.page.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
        throw pageSlugTaken();
      }
      const page = await tx.page.create({
        data: {
          ...input,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
        },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'page.create',
          entityType: 'page',
          entityId: page.id,
          changes: { slug: input.slug, title: input.title, status: input.status },
        },
        tx,
      );
      return page.id;
    });
    return this.page(id);
  }

  async updatePage(id: string, input: UpdatePageInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'pages', id))) throw pageNotFound();
      const before = await tx.page.findUniqueOrThrow({ where: { id } });
      assertFresh(before.updatedAt, input.updatedAt, 'page');
      if (PROTECTED_PAGES.has(before.slug)) {
        if (input.slug && input.slug !== before.slug) {
          throw conflict(
            'PAGE_PROTECTED',
            'The storefront needs this page at its current address.',
          );
        }
        if (input.status === 'DRAFT') {
          throw conflict('PAGE_PROTECTED', 'The home page cannot be unpublished.');
        }
      }
      if (input.slug && input.slug !== before.slug) {
        if (await tx.page.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
          throw pageSlugTaken();
        }
      }
      const { updatedAt: _ignored, ...fields } = input;
      await tx.page.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
      await this.audit.record(
        actor,
        { action: 'page.update', entityType: 'page', entityId: id, changes: diff(before, fields) },
        tx,
      );
    });
    return this.page(id);
  }

  async removePage(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'pages', id))) throw pageNotFound();
      const page = await tx.page.findUniqueOrThrow({
        where: { id },
        select: { slug: true, title: true },
      });
      if (PROTECTED_PAGES.has(page.slug)) {
        throw conflict('PAGE_PROTECTED', 'The storefront needs this page; it cannot be deleted.');
      }
      await tx.page.delete({ where: { id } });
      await this.audit.record(
        actor,
        { action: 'page.delete', entityType: 'page', entityId: id, changes: page },
        tx,
      );
    });
  }

  // ─── Sections ───

  async addSection(pageId: string, input: CreateSectionInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'pages', pageId))) throw pageNotFound();
      const settings = parseSectionSettings(input.type, input.settings);
      const siblings = await tx.pageSection.findMany({
        where: { pageId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const index = Math.min(input.position ?? siblings.length, siblings.length);
      const section = await tx.pageSection.create({
        data: {
          pageId,
          type: input.type,
          settings,
          isVisible: input.isVisible,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          position: index,
        },
        select: { id: true },
      });
      const order = siblings.map((s) => s.id);
      order.splice(index, 0, section.id);
      await this.setPositions(tx, order);
      await this.touchPage(tx, pageId);
      await this.audit.record(
        actor,
        {
          action: 'page.section.create',
          entityType: 'page',
          entityId: pageId,
          changes: { sectionId: section.id, type: input.type, position: index },
        },
        tx,
      );
    });
    return this.page(pageId);
  }

  async updateSection(
    pageId: string,
    sectionId: string,
    input: UpdateSectionInput,
    actor: AuditActor,
  ) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'page_sections', sectionId))) throw sectionNotFound();
      const before = await tx.pageSection.findFirst({ where: { id: sectionId, pageId } });
      if (!before) throw sectionNotFound();
      assertFresh(before.updatedAt, input.updatedAt, 'section');
      const startsAt = input.startsAt === undefined ? before.startsAt : input.startsAt;
      const endsAt = input.endsAt === undefined ? before.endsAt : input.endsAt;
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new ValidationFailedException([
          { path: 'endsAt', message: 'must be after the start' },
        ]);
      }
      const settings =
        input.settings === undefined
          ? undefined
          : parseSectionSettings(before.type, input.settings);
      const data = {
        settings,
        isVisible: input.isVisible,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      };
      await tx.pageSection.update({
        where: { id: sectionId },
        data: { ...data, updatedAt: new Date() },
      });
      await this.touchPage(tx, pageId);
      await this.audit.record(
        actor,
        {
          action: 'page.section.update',
          entityType: 'page',
          entityId: pageId,
          changes: {
            sectionId,
            type: before.type,
            ...diff(before as unknown as Record<string, unknown>, data),
          },
        },
        tx,
      );
    });
    return this.page(pageId);
  }

  async removeSection(pageId: string, sectionId: string, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'pages', pageId))) throw pageNotFound();
      const section = await tx.pageSection.findFirst({
        where: { id: sectionId, pageId },
        select: { type: true, settings: true },
      });
      if (!section) throw sectionNotFound();
      await tx.pageSection.delete({ where: { id: sectionId } });
      const rest = await tx.pageSection.findMany({
        where: { pageId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      await this.setPositions(
        tx,
        rest.map((s) => s.id),
      );
      await this.touchPage(tx, pageId);
      // The settings are kept in the audit log, so a deleted section can be recreated.
      await this.audit.record(
        actor,
        {
          action: 'page.section.delete',
          entityType: 'page',
          entityId: pageId,
          changes: { sectionId, ...section },
        },
        tx,
      );
    });
    return this.page(pageId);
  }

  async reorderSections(pageId: string, ids: string[], actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'pages', pageId))) throw pageNotFound();
      const current = await tx.pageSection.findMany({ where: { pageId }, select: { id: true } });
      if (
        !sameMembers(
          ids,
          current.map((s) => s.id),
        )
      ) {
        throw new ValidationFailedException([
          { path: 'ids', message: 'Send every section of this page exactly once.' },
        ]);
      }
      await this.setPositions(tx, ids);
      await this.touchPage(tx, pageId);
      await this.audit.record(
        actor,
        { action: 'page.section.reorder', entityType: 'page', entityId: pageId, changes: { ids } },
        tx,
      );
    });
    return this.page(pageId);
  }

  // ─── Menus ───

  async menus() {
    const rows = await this.prisma.menu.findMany({
      orderBy: { key: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
    return rows.map(({ _count, ...m }) => ({
      ...m,
      items: _count.items,
      protected: PROTECTED_MENUS.has(m.key),
    }));
  }

  /** The full tree, hidden items included (same shape as the PUT body). */
  async menu(key: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { key },
      select: {
        key: true,
        name: true,
        updatedAt: true,
        items: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            parentId: true,
            label: true,
            url: true,
            openInNewTab: true,
            isVisible: true,
            settings: true,
          },
        },
      },
    });
    if (!menu) throw menuNotFound();
    const byParent = Map.groupBy(menu.items, (i) => i.parentId ?? 'root');
    type Node = Omit<(typeof menu.items)[number], 'parentId'> & { children: Node[] };
    const build = (parentId: string): Node[] =>
      (byParent.get(parentId) ?? []).map(({ parentId: _p, ...item }) => ({
        ...item,
        children: build(item.id),
      }));
    return { key: menu.key, name: menu.name, updatedAt: menu.updatedAt, items: build('root') };
  }

  /** Creates the menu or replaces its whole tree. */
  async putMenu(key: string, input: PutMenuInput, actor: AuditActor) {
    await this.write(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`menu:${key}`}))`;
      const existing = await tx.menu.findUnique({ where: { key } });
      if (existing) {
        assertFresh(existing.updatedAt, input.updatedAt ?? new Date(0), 'menu');
      } else if (input.updatedAt) {
        throw conflict('STALE_UPDATE', 'This menu was deleted since you opened it.');
      }
      const menu = existing
        ? await tx.menu.update({
            where: { key },
            data: { name: input.name, updatedAt: new Date() },
          })
        : await tx.menu.create({ data: { key, name: input.name } });
      const before = existing ? await tx.menuItem.count({ where: { menuId: menu.id } }) : 0;
      await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
      const rows = flattenMenu(menu.id, input.items);
      await tx.menuItem.createMany({ data: rows });
      await this.audit.record(
        actor,
        {
          action: existing ? 'menu.update' : 'menu.create',
          entityType: 'menu',
          entityId: menu.id,
          changes: { key, name: input.name, itemsBefore: before, itemsAfter: rows.length },
        },
        tx,
      );
    });
    return this.menu(key);
  }

  async removeMenu(key: string, actor: AuditActor): Promise<void> {
    if (PROTECTED_MENUS.has(key)) {
      throw conflict('MENU_PROTECTED', 'The storefront uses this menu; it cannot be deleted.');
    }
    await this.write(async (tx) => {
      const menu = await tx.menu.findUnique({ where: { key }, select: { id: true, name: true } });
      if (!menu) throw menuNotFound();
      await tx.menu.delete({ where: { key } });
      await this.audit.record(
        actor,
        {
          action: 'menu.delete',
          entityType: 'menu',
          entityId: menu.id,
          changes: { key, name: menu.name },
        },
        tx,
      );
    });
  }

  // ─── Helpers ───

  private async setPositions(tx: Tx, ids: string[]) {
    for (const [position, id] of ids.entries()) {
      await tx.pageSection.update({ where: { id }, data: { position }, select: { id: true } });
    }
  }

  private touchPage(tx: Tx, id: string) {
    return tx.page.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } });
  }

  private async write<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    let result: T;
    try {
      result = await this.prisma.$transaction(work, { timeout: 20_000 });
    } catch (error) {
      if (isUniqueViolation(error, 'slug')) throw pageSlugTaken();
      throw error;
    }
    await this.content.invalidate();
    return result;
  }
}

const pageSlugTaken = () => conflict('SLUG_TAKEN', 'Another page already uses that address.');
