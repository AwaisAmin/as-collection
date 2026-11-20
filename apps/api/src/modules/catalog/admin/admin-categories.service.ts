import type { AdminCategoryDto, AdminCategoryNodeDto, CategoryBannerDto } from '@as/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../app.module.js';
import {
  assertFresh,
  checkImages,
  compact,
  conflict,
  freeSlug,
  jsonOrNull,
  lockRow,
  notFound,
  sameMembers,
  type Tx,
} from '../../../common/admin-write.js';
import { uuidv7 } from '../../../common/crypto.js';
import {
  type FieldError,
  ValidationFailedException,
} from '../../../common/http/problem-details.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { mediaUrl } from '../catalog.mapper.js';
import { CatalogService } from '../catalog.service.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './taxonomy.schemas.js';

/** Same limit as the `categories_depth_check` constraint (0 = top level). */
export const MAX_DEPTH = 10;

const categoryNotFound = () => notFound('CATEGORY_NOT_FOUND', 'Category not found.');
const slugTaken = () => conflict('SLUG_TAKEN', 'Another category already uses that URL slug.');

const imageSelect = { id: true, storageKey: true, alt: true } as const;

const categorySelect = {
  id: true,
  parentId: true,
  slug: true,
  name: true,
  description: true,
  path: true,
  depth: true,
  position: true,
  isActive: true,
  banner: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  image: { select: imageSelect },
  bannerImage: { select: imageSelect },
  attributes: {
    orderBy: { position: 'asc' },
    select: { attributeId: true, isRequired: true, attribute: { select: { name: true } } },
  },
  _count: { select: { children: true, primaryProducts: true, productLinks: true } },
} satisfies Prisma.CategorySelect;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

const editable = [
  'name',
  'slug',
  'description',
  'isActive',
  'imageId',
  'bannerImageId',
  'banner',
  'seoTitle',
  'seoDescription',
] as const;

/**
 * Category tree editing. `path` ("/root/…/self/") and `depth` are maintained here; moving a
 * category rewrites its whole subtree in one statement. Tree changes are serialised with a
 * transaction-scoped advisory lock so two moves can never create a cycle.
 */
@Injectable()
export class AdminCategoriesService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.baseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  /** The whole tree (active or not), children in display order. */
  async tree(): Promise<AdminCategoryNodeDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ depth: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      select: categorySelect,
    });
    type Node = AdminCategoryNodeDto;
    const nodes = new Map<string, Node>();
    const roots: Node[] = [];
    for (const row of rows) {
      const node: Node = { ...this.toDto(row), children: [] };
      nodes.set(row.id, node);
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  async get(id: string) {
    const row = await this.prisma.category.findUnique({ where: { id }, select: categorySelect });
    if (!row) throw categoryNotFound();
    return this.toDto(row);
  }

  async create(input: CreateCategoryInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      await this.lockTree(tx);
      const parent = input.parentId ? await this.parent(tx, input.parentId) : null;
      const errors = await this.checkRefs(tx, input);
      if (parent && parent.depth + 1 > MAX_DEPTH) {
        errors.push({
          path: 'parentId',
          message: `Categories nest at most ${String(MAX_DEPTH + 1)} levels deep.`,
        });
      }
      if (errors.length) throw new ValidationFailedException(errors);

      const slug =
        input.slug ??
        (await freeSlug(input.name, 'category', (base) =>
          tx.category.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }),
        ));
      if (input.slug && (await tx.category.findUnique({ where: { slug }, select: { id: true } }))) {
        throw slugTaken();
      }
      const id = uuidv7();
      const siblings = await tx.category.aggregate({
        where: { parentId: input.parentId },
        _max: { position: true },
      });
      await tx.category.create({
        data: {
          id,
          parentId: input.parentId,
          slug,
          name: input.name,
          description: input.description ?? null,
          path: `${parent?.path ?? '/'}${id}/`,
          depth: parent ? parent.depth + 1 : 0,
          position: (siblings._max.position ?? -1) + 1,
          isActive: input.isActive,
          imageId: input.imageId,
          bannerImageId: input.bannerImageId,
          banner: jsonOrNull(compact(input.banner)),
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          attributes: {
            createMany: {
              data: input.attributes.map((a, position) => ({ ...a, position })),
            },
          },
        },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'category.create',
          entityType: 'category',
          entityId: id,
          changes: { name: input.name, slug, parentId: input.parentId },
        },
        tx,
      );
      return id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateCategoryInput, actor: AuditActor) {
    await this.write(async (tx) => {
      const moving = input.parentId !== undefined;
      if (moving) await this.lockTree(tx);
      if (!(await lockRow(tx, 'categories', id))) throw categoryNotFound();
      const before = await tx.category.findUniqueOrThrow({ where: { id } });
      assertFresh(before.updatedAt, input.updatedAt, 'category');

      const errors = await this.checkRefs(tx, input);
      if (errors.length) throw new ValidationFailedException(errors);
      if (input.slug && input.slug !== before.slug) {
        if (await tx.category.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
          throw slugTaken();
        }
      }

      const data: Prisma.CategoryUncheckedUpdateInput = { updatedAt: new Date() };
      for (const field of editable) {
        if (input[field] === undefined) continue;
        Object.assign(data, {
          [field]: field === 'banner' ? jsonOrNull(compact(input.banner)) : input[field],
        });
      }
      if (moving && input.parentId !== before.parentId) {
        await this.move(tx, before, input.parentId ?? null);
        const siblings = await tx.category.aggregate({
          where: { parentId: input.parentId ?? null, id: { not: id } },
          _max: { position: true },
        });
        data.parentId = input.parentId ?? null;
        data.position = (siblings._max.position ?? -1) + 1;
      }
      await tx.category.update({ where: { id }, data, select: { id: true } });
      if (input.attributes) {
        await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
        await tx.categoryAttribute.createMany({
          data: input.attributes.map((a, position) => ({ categoryId: id, ...a, position })),
        });
      }
      await this.audit.record(
        actor,
        {
          action: 'category.update',
          entityType: 'category',
          entityId: id,
          changes: {
            ...diff(before as unknown as Record<string, unknown>, {
              ...Object.fromEntries(editable.map((f) => [f, input[f]])),
              parentId: input.parentId,
            }),
            ...(input.attributes ? { attributesReplaced: true } : {}),
          },
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Sets the display order of one parent's children. */
  async reorder(parentId: string | null, ids: string[], actor: AuditActor) {
    await this.write(async (tx) => {
      await this.lockTree(tx);
      const siblings = await tx.category.findMany({ where: { parentId }, select: { id: true } });
      if (
        !sameMembers(
          ids,
          siblings.map((s) => s.id),
        )
      ) {
        throw new ValidationFailedException([
          { path: 'ids', message: 'Send every child of this parent exactly once.' },
        ]);
      }
      for (const [position, id] of ids.entries()) {
        await tx.category.update({ where: { id }, data: { position }, select: { id: true } });
      }
      await this.audit.record(
        actor,
        {
          action: 'category.reorder',
          entityType: 'category',
          entityId: parentId,
          changes: { ids },
        },
        tx,
      );
    });
    return this.tree();
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      await this.lockTree(tx);
      if (!(await lockRow(tx, 'categories', id))) throw categoryNotFound();
      const row = await tx.category.findUniqueOrThrow({
        where: { id },
        select: {
          name: true,
          slug: true,
          _count: { select: { children: true, primaryProducts: true } },
        },
      });
      if (row._count.children > 0) {
        throw conflict('CATEGORY_HAS_CHILDREN', 'Move or delete its subcategories first.');
      }
      if (row._count.primaryProducts > 0) {
        throw conflict(
          'CATEGORY_IN_USE',
          `${String(row._count.primaryProducts)} product(s) have this as their main category. Move them first.`,
          { products: row._count.primaryProducts },
        );
      }
      await tx.category.delete({ where: { id } });
      await this.audit.record(
        actor,
        {
          action: 'category.delete',
          entityType: 'category',
          entityId: id,
          changes: { name: row.name, slug: row.slug },
        },
        tx,
      );
    });
  }

  // ─── Helpers ───

  private async write<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    let result: T;
    try {
      result = await this.prisma.$transaction(work, { timeout: 20_000 });
    } catch (error) {
      if (isUniqueViolation(error, 'slug')) throw slugTaken();
      throw error;
    }
    await this.catalog.invalidate();
    return result;
  }

  /** One tree change at a time (released at commit). */
  private async lockTree(tx: Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('category-tree'))`;
  }

  private async parent(tx: Tx, id: string) {
    const parent = await tx.category.findUnique({
      where: { id },
      select: { path: true, depth: true },
    });
    if (!parent) {
      throw new ValidationFailedException([{ path: 'parentId', message: 'Unknown category.' }]);
    }
    return parent;
  }

  /** Rewrites the subtree's paths and depths for a new parent (validated: no cycles, depth). */
  private async move(
    tx: Tx,
    category: { id: string; path: string; depth: number },
    parentId: string | null,
  ) {
    const parent = parentId ? await this.parent(tx, parentId) : null;
    if (parent?.path.startsWith(category.path)) {
      throw new ValidationFailedException([
        { path: 'parentId', message: 'A category cannot be moved inside itself.' },
      ]);
    }
    const newPath = `${parent?.path ?? '/'}${category.id}/`;
    const delta = (parent ? parent.depth + 1 : 0) - category.depth;
    const [deepest] = await tx.$queryRaw<{ max: number }[]>`
      SELECT max(depth)::int AS max FROM categories WHERE path LIKE ${`${category.path}%`}`;
    if ((deepest?.max ?? category.depth) + delta > MAX_DEPTH) {
      throw new ValidationFailedException([
        {
          path: 'parentId',
          message: `That would nest categories more than ${String(MAX_DEPTH + 1)} levels deep.`,
        },
      ]);
    }
    // UUID paths contain no LIKE wildcards. Descendants first keep the old prefix until updated.
    await tx.$executeRaw`
      UPDATE categories
      SET path = ${newPath} || substr(path, ${category.path.length + 1}),
          depth = depth + ${delta}, updated_at = now()
      WHERE path LIKE ${`${category.path}%`}`;
  }

  private async checkRefs(
    tx: Tx,
    input: {
      imageId?: string | null | undefined;
      bannerImageId?: string | null | undefined;
      attributes?: { attributeId: string }[] | undefined;
    },
  ): Promise<FieldError[]> {
    const errors = await checkImages(tx, {
      imageId: input.imageId,
      bannerImageId: input.bannerImageId,
    });
    if (input.attributes?.length) {
      const found = new Set(
        (
          await tx.attribute.findMany({
            where: { id: { in: input.attributes.map((a) => a.attributeId) } },
            select: { id: true },
          })
        ).map((a) => a.id),
      );
      input.attributes.forEach((a, i) => {
        if (!found.has(a.attributeId)) {
          errors.push({
            path: `attributes.${String(i)}.attributeId`,
            message: 'Unknown attribute.',
          });
        }
      });
    }
    return errors;
  }

  private toDto(row: CategoryRow): AdminCategoryDto {
    const image = (m: CategoryRow['image']) =>
      m ? { id: m.id, url: mediaUrl(this.baseUrl, m.storageKey), alt: m.alt } : null;
    return {
      id: row.id,
      parentId: row.parentId,
      slug: row.slug,
      name: row.name,
      description: row.description,
      depth: row.depth,
      position: row.position,
      isActive: row.isActive,
      image: image(row.image),
      bannerImage: image(row.bannerImage),
      banner: row.banner as CategoryBannerDto | null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      attributes: row.attributes.map((a) => ({
        attributeId: a.attributeId,
        name: a.attribute.name,
        isRequired: a.isRequired,
      })),
      counts: {
        children: row._count.children,
        /** Products whose main category this is. */
        products: row._count.primaryProducts,
        /** Products listed here as an extra category. */
        extraProducts: row._count.productLinks,
      },
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
