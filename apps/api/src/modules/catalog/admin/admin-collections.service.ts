import type {
  AdminCollectionDetailDto,
  AdminCollectionDto,
  CollectionPreviewDto,
  CollectionProductDto,
  CollectionRulesDto,
} from '@as/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../app.module.js';
import {
  assertFresh,
  checkImages,
  conflict,
  freeSlug,
  jsonOrNull,
  lockRow,
  notFound,
  sameMembers,
  type Tx,
} from '../../../common/admin-write.js';
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
import { type CollectionRules, rulesWhere } from '../product-query.js';
import type { CreateCollectionInput, UpdateCollectionInput } from './taxonomy.schemas.js';

const collectionNotFound = () => notFound('COLLECTION_NOT_FOUND', 'Collection not found.');
const slugTaken = () => conflict('SLUG_TAKEN', 'Another collection already uses that URL slug.');

const collectionSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  type: true,
  rules: true,
  isActive: true,
  position: true,
  startsAt: true,
  endsAt: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  image: { select: { id: true, storageKey: true, alt: true } },
  _count: { select: { products: true } },
} satisfies Prisma.CollectionSelect;

type CollectionRow = Prisma.CollectionGetPayload<{ select: typeof collectionSelect }>;

const editable = [
  'name',
  'slug',
  'description',
  'type',
  'imageId',
  'isActive',
  'position',
  'startsAt',
  'endsAt',
  'seoTitle',
  'seoDescription',
] as const;

/** Whether shoppers see it right now (the storefront applies the same rule). */
export function collectionState(
  c: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): 'live' | 'scheduled' | 'ended' | 'hidden' {
  if (!c.isActive) return 'hidden';
  if (c.startsAt && c.startsAt > now) return 'scheduled';
  if (c.endsAt && c.endsAt <= now) return 'ended';
  return 'live';
}

/**
 * Merchandising collections: hand-picked (ordered product list) or automated (rules evaluated
 * by the storefront query). Rules are checked against the catalog so a typo cannot silently
 * produce an empty collection; `preview` shows what rules match before saving.
 */
@Injectable()
export class AdminCollectionsService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.baseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  async list(): Promise<AdminCollectionDto[]> {
    const rows = await this.prisma.collection.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: collectionSelect,
    });
    const now = new Date();
    return Promise.all(rows.map(async (row) => this.toDto(row, await this.productCount(row), now)));
  }

  async get(id: string): Promise<AdminCollectionDetailDto> {
    const row = await this.prisma.collection.findUnique({
      where: { id },
      select: collectionSelect,
    });
    if (!row) throw collectionNotFound();
    const products =
      row.type === 'MANUAL'
        ? await this.prisma.collectionProduct.findMany({
            where: { collectionId: id },
            orderBy: [{ position: 'asc' }, { productId: 'asc' }],
            select: { product: { select: productPreviewSelect } },
          })
        : [];
    return {
      ...this.toDto(row, await this.productCount(row), new Date()),
      products: products.map((p) => this.previewItem(p.product)),
    };
  }

  /** Which live products the rules match (count and the first few), without saving. */
  async preview(rules: CollectionRules): Promise<CollectionPreviewDto> {
    const errors = await this.checkRules(this.prisma, rules);
    if (errors.length) throw new ValidationFailedException(errors);
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...rulesWhere(rules, { now: new Date() }),
    };
    const [count, sample] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: productPreviewSelect,
      }),
    ]);
    return { count, sample: sample.map((p) => this.previewItem(p)) };
  }

  async create(input: CreateCollectionInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      const errors = await checkImages(tx, { imageId: input.imageId });
      if (input.rules) errors.push(...(await this.checkRules(tx, input.rules)));
      if (errors.length) throw new ValidationFailedException(errors);
      const slug =
        input.slug ??
        (await freeSlug(input.name, 'collection', (base) =>
          tx.collection.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }),
        ));
      const last = await tx.collection.aggregate({ _max: { position: true } });
      const created = await tx.collection.create({
        data: {
          ...input,
          slug,
          description: input.description ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          rules: jsonOrNull(input.type === 'AUTOMATED' ? input.rules : null),
          position: input.position ?? (last._max.position ?? -1) + 1,
        },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'collection.create',
          entityType: 'collection',
          entityId: created.id,
          changes: { name: input.name, slug, type: input.type, rules: input.rules },
        },
        tx,
      );
      return created.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateCollectionInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'collections', id))) throw collectionNotFound();
      const before = await tx.collection.findUniqueOrThrow({ where: { id } });
      assertFresh(before.updatedAt, input.updatedAt, 'collection');

      const type = input.type ?? before.type;
      const rules = input.rules === undefined ? before.rules : input.rules;
      const errors = await checkImages(tx, { imageId: input.imageId });
      if (type === 'AUTOMATED' && !rules) {
        errors.push({ path: 'rules', message: 'Automated collections need rules.' });
      }
      if (input.rules) errors.push(...(await this.checkRules(tx, input.rules)));
      const startsAt = input.startsAt === undefined ? before.startsAt : input.startsAt;
      const endsAt = input.endsAt === undefined ? before.endsAt : input.endsAt;
      if (startsAt && endsAt && endsAt <= startsAt) {
        errors.push({ path: 'endsAt', message: 'must be after the start' });
      }
      if (errors.length) throw new ValidationFailedException(errors);
      if (input.slug && input.slug !== before.slug) {
        if (await tx.collection.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
          throw slugTaken();
        }
      }

      const data: Prisma.CollectionUncheckedUpdateInput = { updatedAt: new Date() };
      for (const field of editable) {
        if (input[field] !== undefined) Object.assign(data, { [field]: input[field] });
      }
      // Automated collections are defined by rules only; manual ones by their product list.
      if (type === 'AUTOMATED') {
        data.rules = jsonOrNull(rules as object);
        if (before.type === 'MANUAL')
          await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
      } else {
        data.rules = jsonOrNull(null);
      }
      await tx.collection.update({ where: { id }, data, select: { id: true } });
      await this.audit.record(
        actor,
        {
          action: 'collection.update',
          entityType: 'collection',
          entityId: id,
          changes: diff(before as unknown as Record<string, unknown>, {
            ...Object.fromEntries(editable.map((f) => [f, input[f]])),
            rules: input.rules,
          }),
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Replaces a hand-picked collection's products, in display order. */
  async setProducts(id: string, productIds: string[], actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'collections', id))) throw collectionNotFound();
      const collection = await tx.collection.findUniqueOrThrow({
        where: { id },
        select: { type: true },
      });
      if (collection.type !== 'MANUAL') {
        throw conflict('NOT_MANUAL', 'Automated collections are filled by their rules.');
      }
      const found = new Set(
        (
          await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
        ).map((p) => p.id),
      );
      const errors: FieldError[] = productIds.flatMap((pid, i) =>
        found.has(pid) ? [] : [{ path: `productIds.${String(i)}`, message: 'Unknown product.' }],
      );
      if (errors.length) throw new ValidationFailedException(errors);
      const before = await tx.collectionProduct.count({ where: { collectionId: id } });
      await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
      await tx.collectionProduct.createMany({
        data: productIds.map((productId, position) => ({ collectionId: id, productId, position })),
      });
      await tx.collection.update({
        where: { id },
        data: { updatedAt: new Date() },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'collection.products',
          entityType: 'collection',
          entityId: id,
          changes: { before, after: productIds.length },
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Display order of all collections. */
  async reorder(ids: string[], actor: AuditActor) {
    await this.write(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('collections-order'))`;
      const all = await tx.collection.findMany({ select: { id: true } });
      if (
        !sameMembers(
          ids,
          all.map((c) => c.id),
        )
      ) {
        throw new ValidationFailedException([
          { path: 'ids', message: 'Send every collection exactly once.' },
        ]);
      }
      for (const [position, id] of ids.entries()) {
        await tx.collection.update({ where: { id }, data: { position }, select: { id: true } });
      }
      await this.audit.record(
        actor,
        { action: 'collection.reorder', entityType: 'collection', changes: { ids } },
        tx,
      );
    });
    return this.list();
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'collections', id))) throw collectionNotFound();
      const row = await tx.collection.findUniqueOrThrow({
        where: { id },
        select: { name: true, slug: true },
      });
      await tx.collection.delete({ where: { id } });
      await this.audit.record(
        actor,
        { action: 'collection.delete', entityType: 'collection', entityId: id, changes: row },
        tx,
      );
    });
  }

  // ─── Helpers ───

  /** Every attribute code / value and tag in the rules must exist. */
  private async checkRules(tx: Tx | PrismaService, rules: CollectionRules): Promise<FieldError[]> {
    const list = 'all' in rules ? rules.all : rules.any;
    const key = 'all' in rules ? 'all' : 'any';
    const codes = list.flatMap((r) => (r.field === 'attribute' ? [r.code] : []));
    const tags = list.flatMap((r) => (r.field === 'tag' ? r.value : []));
    // Sequential: a transaction is one connection, which runs one query at a time.
    const attributes = codes.length
      ? await tx.attribute.findMany({
          where: { code: { in: codes } },
          select: { code: true, values: { select: { value: true } } },
        })
      : [];
    const knownTags = tags.length
      ? await tx.tag.findMany({ where: { slug: { in: tags } }, select: { slug: true } })
      : [];
    const valuesByCode = new Map(
      attributes.map((a) => [a.code, new Set(a.values.map((v) => v.value))]),
    );
    const tagSet = new Set(knownTags.map((t) => t.slug));
    const errors: FieldError[] = [];
    list.forEach((rule, i) => {
      const path = `rules.${key}.${String(i)}`;
      if (rule.field === 'tag') {
        const missing = rule.value.filter((t) => !tagSet.has(t));
        if (missing.length) errors.push({ path, message: `No such tag: ${missing.join(', ')}.` });
      }
      if (rule.field === 'attribute') {
        const values = valuesByCode.get(rule.code);
        if (!values) {
          errors.push({ path, message: `No attribute "${rule.code}".` });
          return;
        }
        const missing = rule.value.filter((v) => !values.has(v));
        if (missing.length)
          errors.push({ path, message: `Not a ${rule.code} value: ${missing.join(', ')}.` });
      }
    });
    return errors;
  }

  private async productCount(row: Pick<CollectionRow, 'type' | 'rules' | '_count'>) {
    if (row.type === 'MANUAL') return row._count.products;
    if (!row.rules) return 0;
    return this.prisma.product.count({
      where: { status: 'ACTIVE', ...rulesWhere(row.rules as CollectionRules, { now: new Date() }) },
    });
  }

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

  private toDto(row: CollectionRow, productCount: number, now: Date): AdminCollectionDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      type: row.type,
      rules: row.rules as CollectionRulesDto | null,
      isActive: row.isActive,
      state: collectionState(row, now),
      position: row.position,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      image: row.image
        ? {
            id: row.image.id,
            url: mediaUrl(this.baseUrl, row.image.storageKey),
            alt: row.image.alt,
          }
        : null,
      /** Manual: products in the list; automated: live products matching the rules now. */
      productCount,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private previewItem(
    p: Prisma.ProductGetPayload<{ select: typeof productPreviewSelect }>,
  ): CollectionProductDto {
    const image = p.media[0]?.media;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      priceMinMinor: p.priceMinMinor,
      image: image ? { url: mediaUrl(this.baseUrl, image.storageKey), alt: image.alt } : null,
    };
  }
}

const productPreviewSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  priceMinMinor: true,
  media: {
    orderBy: { position: 'asc' },
    take: 1,
    select: { media: { select: { storageKey: true, alt: true } } },
  },
} satisfies Prisma.ProductSelect;
