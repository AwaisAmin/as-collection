import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import type { AppConfig } from '../../app.module.js';
import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../redis/cache.service.js';
import { SETTINGS_CACHE } from '../orders/store-settings.service.js';
import {
  hrefSchema,
  isPublicSettingKey,
  isSectionType,
  menuItemSettingsSchema,
  promotionSchema,
  PUBLIC_SETTINGS,
  type PublicSettingKey,
  SECTION_SCHEMAS,
} from './content.schemas.js';

/** Cache namespace for pages and menus. Admin content edits call `invalidate()` (B7). */
export const CONTENT_CACHE = 'content';

export interface SectionDto {
  id: string;
  type: string;
  settings: unknown;
  /** Campaign end (ISO), so the storefront can hide the block at the exact moment. */
  endsAt: string | null;
}

interface CachedSection extends SectionDto {
  startsAt: string | null;
}

export interface PageDto {
  slug: string;
  title: string;
  seo: { title: string | null; description: string | null };
  sections: SectionDto[];
}

interface CachedPage extends Omit<PageDto, 'sections'> {
  sections: CachedSection[];
}

export interface MenuItemDto {
  id: string;
  label: string;
  url: string | null;
  openInNewTab: boolean;
  settings: z.infer<typeof menuItemSettingsSchema> | null;
  children: MenuItemDto[];
}

export interface MenuDto {
  key: string;
  name: string;
  items: MenuItemDto[];
}

export type PublicSettings = { [K in PublicSettingKey]?: z.infer<(typeof PUBLIC_SETTINGS)[K]> };

export type PromotionDto = z.infer<typeof promotionSchema>;

/** Scheduled content is live from `startsAt` (inclusive) until `endsAt` (exclusive). */
export const isLive = (
  item: { startsAt: string | null; endsAt: string | null },
  now: Date,
): boolean =>
  (item.startsAt === null || new Date(item.startsAt) <= now) &&
  (item.endsAt === null || new Date(item.endsAt) > now);

/**
 * Storefront content: pages built from sections, navigation menus, public settings and the
 * active promotion. Everything is read through Redis; stored JSON is validated per type and
 * invalid entries are skipped (logged), so one bad edit cannot take the storefront down.
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger('Content');
  private readonly ttl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.ttl = config.get('CATALOG_CACHE_TTL_SECONDS', { infer: true });
  }

  /** Pages and menus become stale at once. Settings edits call `StoreSettingsService.invalidate`. */
  invalidate(): Promise<void> {
    return this.cache.invalidate(CONTENT_CACHE);
  }

  /** A published page with its visible, currently scheduled sections in order. */
  async page(slug: string, now = new Date()): Promise<PageDto> {
    const page = await this.cache.getOrSet(CONTENT_CACHE, `page:${slug}`, this.ttl, () =>
      this.loadPage(slug),
    );
    if (!page) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'PAGE_NOT_FOUND', 'Page not found.');
    }
    return {
      ...page,
      sections: page.sections
        .filter((s) => isLive(s, now))
        .map(({ id, type, settings, endsAt }) => ({ id, type, settings, endsAt })),
    };
  }

  /** The home page's live sale banner, if any (also feeds the mega-menu feature card). */
  async activePromotion(now = new Date()): Promise<PromotionDto | null> {
    const home = await this.page('home', now).catch((error: unknown) => {
      if (error instanceof DomainException && error.code === 'PAGE_NOT_FOUND') return null;
      throw error;
    });
    const banner = home?.sections.find((s) => s.type === 'sale-banner');
    if (!banner) return null;
    const promotion = banner.settings as PromotionDto;
    return new Date(promotion.endsAt) > now ? promotion : null;
  }

  async menu(key: string): Promise<MenuDto> {
    const menu = await this.cache.getOrSet(CONTENT_CACHE, `menu:${key}`, this.ttl, () =>
      this.loadMenu(key),
    );
    if (!menu) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', 'Menu not found.');
    }
    return menu;
  }

  /** Every public setting that exists and is valid, keyed by setting key. */
  async settings(): Promise<PublicSettings> {
    return this.cache.getOrSet(SETTINGS_CACHE, 'public', this.ttl, async () => {
      const rows = await this.prisma.setting.findMany({
        where: { key: { in: Object.keys(PUBLIC_SETTINGS) } },
        select: { key: true, value: true },
      });
      const settings: PublicSettings = {};
      for (const { key, value } of rows) {
        if (!isPublicSettingKey(key)) continue;
        const parsed = PUBLIC_SETTINGS[key].safeParse(value);
        if (parsed.success) Object.assign(settings, { [key]: parsed.data });
        else this.logger.warn(`Setting "${key}" is invalid and was not served`);
      }
      return settings;
    });
  }

  async setting(key: string): Promise<unknown> {
    const settings = await this.settings();
    const value = isPublicSettingKey(key) ? settings[key] : undefined;
    if (value === undefined) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'SETTING_NOT_FOUND', 'Setting not found.');
    }
    return value;
  }

  // ─── Loaders ───

  private async loadPage(slug: string): Promise<CachedPage | null> {
    const page = await this.prisma.page.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        title: true,
        seoTitle: true,
        seoDescription: true,
        sections: {
          where: { isVisible: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: { id: true, type: true, settings: true, startsAt: true, endsAt: true },
        },
      },
    });
    if (!page) return null;

    const sections: CachedSection[] = [];
    for (const s of page.sections) {
      if (!isSectionType(s.type)) {
        this.logger.warn(`Section ${s.id} has unknown type "${s.type}" and was skipped`);
        continue;
      }
      const parsed = SECTION_SCHEMAS[s.type].safeParse(s.settings);
      if (!parsed.success) {
        this.logger.warn(`Section ${s.id} (${s.type}) has invalid settings and was skipped`);
        continue;
      }
      sections.push({
        id: s.id,
        type: s.type,
        settings: parsed.data,
        startsAt: s.startsAt?.toISOString() ?? null,
        endsAt: s.endsAt?.toISOString() ?? null,
      });
    }
    return {
      slug: page.slug,
      title: page.title,
      seo: { title: page.seoTitle, description: page.seoDescription },
      sections,
    };
  }

  private async loadMenu(key: string): Promise<MenuDto | null> {
    const menu = await this.prisma.menu.findUnique({
      where: { key },
      select: {
        key: true,
        name: true,
        items: {
          where: { isVisible: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            parentId: true,
            label: true,
            url: true,
            openInNewTab: true,
            settings: true,
          },
        },
      },
    });
    if (!menu) return null;
    return { key: menu.key, name: menu.name, items: buildMenuTree(menu.items) };
  }
}

interface MenuItemRow {
  id: string;
  parentId: string | null;
  label: string;
  url: string | null;
  openInNewTab: boolean;
  settings: unknown;
}

/**
 * Flat rows (already ordered) → nested tree. Items with an unsafe URL, invalid settings, or a
 * hidden/missing parent are dropped together with their subtree.
 */
export function buildMenuTree(rows: readonly MenuItemRow[], maxDepth = 3): MenuItemDto[] {
  const children = Map.groupBy(rows, (r) => r.parentId ?? 'root');
  const build = (parentId: string, depth: number): MenuItemDto[] =>
    depth > maxDepth
      ? []
      : (children.get(parentId) ?? []).flatMap((row) => {
          const url = row.url === null ? null : hrefSchema.safeParse(row.url);
          const settings =
            row.settings === null ? null : menuItemSettingsSchema.safeParse(row.settings);
          if (url?.success === false || settings?.success === false) return [];
          return [
            {
              id: row.id,
              label: row.label,
              url: url?.data ?? null,
              openInNewTab: row.openInNewTab,
              settings: settings?.data ?? null,
              children: build(row.id, depth + 1),
            },
          ];
        });
  return build('root', 1);
}
