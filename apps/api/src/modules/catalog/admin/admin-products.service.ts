import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../app.module.js';
import {
  DomainException,
  type FieldError,
  ValidationFailedException,
} from '../../../common/http/problem-details.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { slugify, uniqueSlug } from '../../../common/slug.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { CatalogService } from '../catalog.service.js';
import {
  adminProductDetailSelect,
  adminProductListSelect,
  toAdminProductDto,
  toAdminProductListItem,
} from './admin-product.mapper.js';
import type {
  AdminProductsQuery,
  CreateProductInput,
  CreateVariantInput,
  MediaInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './product-admin.schemas.js';
import {
  type AttributeDef,
  checkVariantOptions,
  resolveProductAttributes,
  type VariantOptions,
} from './product-validation.js';

type Tx = Prisma.TransactionClient;

const conflict = (code: string, detail: string, extensions?: Record<string, string>) =>
  new DomainException(HttpStatus.CONFLICT, code, detail, extensions ? { extensions } : undefined);

const productNotFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'Product not found.');

/** Unique violations raced past the up-front checks → the same friendly 409s. */
function translateUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error, 'sku')) {
    throw conflict('SKU_TAKEN', 'That SKU is already used by another variant.');
  }
  if (isUniqueViolation(error, 'barcode')) {
    throw conflict('BARCODE_TAKEN', 'That barcode is already used by another variant.');
  }
  if (isUniqueViolation(error, 'slug')) {
    throw conflict('SLUG_TAKEN', 'Another product already uses that URL slug.');
  }
  throw error;
}

/** Scalar product fields as stored (for the audit diff). */
const scalarFields = [
  'name',
  'slug',
  'shortDescription',
  'description',
  'status',
  'primaryCategoryId',
  'brandId',
  'specifications',
  'sizeGuide',
  'isFeatured',
  'isBestseller',
  'seoTitle',
  'seoDescription',
] as const;

/**
 * Staff product editing: products, their variants (SKUs, prices, options), categories, tags,
 * attributes and gallery. Everything for one save happens in one transaction with an audit
 * entry; the storefront cache is invalidated after commit. Stock levels are changed only through
 * the inventory endpoints (ledgered).
 */
@Injectable()
export class AdminProductsService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.baseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  // ─── Reads ───

  async list(query: AdminProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      brandId: query.brand,
      ...(query.category
        ? {
            OR: [
              { primaryCategoryId: query.category },
              { categories: { some: { categoryId: query.category } } },
            ],
          }
        : {}),
    };
    const and: Prisma.ProductWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { slug: query.q },
          { variants: { some: { sku: { startsWith: query.q.toUpperCase() } } } },
        ],
      });
    }
    if (query.lowStock) and.push({ id: { in: await this.lowStockProductIds() } });
    if (and.length) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
      updated: [{ updatedAt: 'desc' as const }],
      newest: [{ createdAt: 'desc' as const }],
      name: [{ name: 'asc' as const }],
      price: [{ priceMinMinor: { sort: 'asc' as const, nulls: 'last' as const } }],
    }[query.sort];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [...orderBy, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminProductListSelect,
      }),
    ]);
    return {
      items: rows.map((row) => toAdminProductListItem(this.baseUrl, row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: adminProductDetailSelect,
    });
    if (!row) throw productNotFound();
    return toAdminProductDto(this.baseUrl, row);
  }

  // ─── Products ───

  async create(input: CreateProductInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      const errors: FieldError[] = [];
      await this.checkReferences(tx, input, errors);
      const defs = await this.attributeDefs(tx, [
        ...input.attributes.map((a) => a.attributeId),
        ...input.variants.flatMap((v) => (v.options ?? []).map((o) => o.attributeId)),
      ]);
      const attributes = resolveProductAttributes(input.attributes, defs);
      errors.push(...attributes.errors);
      errors.push(
        ...checkVariantOptions(
          input.variants.map((v, i) => ({
            path: `variants.${String(i)}`,
            sku: v.sku,
            options: v.options ?? [],
          })),
          defs,
        ),
      );
      const skus = new Set(input.variants.map((v) => v.sku));
      input.media.forEach((m, i) => {
        if (m.variantSku && !skus.has(m.variantSku)) {
          errors.push({
            path: `media.${String(i)}.variantSku`,
            message: 'No variant has this SKU.',
          });
        }
      });
      if (input.status === 'ACTIVE' && !input.variants.some((v) => v.isActive !== false)) {
        errors.push({
          path: 'status',
          message: 'A live product needs at least one active variant.',
        });
      }
      if (errors.length) throw new ValidationFailedException(errors);

      const slug = input.slug ?? (await this.freeSlug(tx, input.name));
      if (input.slug && (await tx.product.findUnique({ where: { slug }, select: { id: true } }))) {
        throw conflict('SLUG_TAKEN', 'Another product already uses that URL slug.');
      }
      await this.assertSkusFree(
        tx,
        input.variants.map((v) => v.sku),
      );

      const product = await tx.product.create({
        data: {
          slug,
          name: input.name,
          shortDescription: input.shortDescription ?? null,
          description: input.description ?? null,
          status: input.status,
          primaryCategoryId: input.primaryCategoryId,
          brandId: input.brandId,
          specifications: input.specifications,
          sizeGuide: input.sizeGuide,
          isFeatured: input.isFeatured,
          isBestseller: input.isBestseller,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          publishedAt: input.status === 'ACTIVE' ? new Date() : null,
        },
        select: { id: true },
      });
      await this.replaceCategories(tx, product.id, input.primaryCategoryId, input.categoryIds);
      await this.replaceTags(tx, product.id, input.tags);
      await tx.productAttributeValue.createMany({
        data: attributes.rows.map((row) => ({ productId: product.id, ...row })),
      });
      const variants = await this.createVariants(tx, product.id, input.variants, actor, 0);
      await this.replaceMedia(tx, product.id, input.media, variants);

      await this.audit.record(
        actor,
        {
          action: 'product.create',
          entityType: 'product',
          entityId: product.id,
          changes: {
            name: input.name,
            slug,
            status: input.status,
            skus: input.variants.map((v) => v.sku),
          },
        },
        tx,
      );
      return product.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateProductInput, actor: AuditActor) {
    await this.write(async (tx) => {
      const before = await this.lockProduct(tx, id, input.updatedAt);
      const errors: FieldError[] = [];
      await this.checkReferences(tx, input, errors);

      let attributeRows: ReturnType<typeof resolveProductAttributes>['rows'] | undefined;
      if (input.attributes) {
        const defs = await this.attributeDefs(
          tx,
          input.attributes.map((a) => a.attributeId),
        );
        const resolved = resolveProductAttributes(input.attributes, defs);
        errors.push(...resolved.errors);
        attributeRows = resolved.rows;
      }
      const variants = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true, sku: true, isActive: true },
      });
      const bySku = new Map(variants.map((v) => [v.sku, v.id]));
      input.media?.forEach((m, i) => {
        if (m.variantSku && !bySku.has(m.variantSku)) {
          errors.push({
            path: `media.${String(i)}.variantSku`,
            message: 'No variant has this SKU.',
          });
        }
      });
      if (input.status === 'ACTIVE' && !variants.some((v) => v.isActive)) {
        errors.push({
          path: 'status',
          message: 'A live product needs at least one active variant.',
        });
      }
      if (errors.length) throw new ValidationFailedException(errors);

      if (input.slug && input.slug !== before.slug) {
        const taken = await tx.product.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        });
        if (taken) throw conflict('SLUG_TAKEN', 'Another product already uses that URL slug.');
      }

      const data: Prisma.ProductUncheckedUpdateInput = {};
      for (const field of scalarFields) {
        if (input[field] !== undefined) Object.assign(data, { [field]: input[field] });
      }
      if (input.status === 'ACTIVE' && !before.publishedAt) data.publishedAt = new Date();
      // Always bump updated_at, even when only lists changed (conflict detection).
      data.updatedAt = new Date();
      await tx.product.update({ where: { id }, data, select: { id: true } });

      if (input.categoryIds !== undefined || input.primaryCategoryId !== undefined) {
        const extra =
          input.categoryIds ??
          (
            await tx.productCategory.findMany({
              where: { productId: id },
              select: { categoryId: true },
            })
          ).map((c) => c.categoryId);
        await this.replaceCategories(
          tx,
          id,
          input.primaryCategoryId ?? before.primaryCategoryId,
          extra,
        );
      }
      if (input.tags) await this.replaceTags(tx, id, input.tags);
      if (attributeRows) {
        await tx.productAttributeValue.deleteMany({ where: { productId: id } });
        await tx.productAttributeValue.createMany({
          data: attributeRows.map((row) => ({ productId: id, ...row })),
        });
      }
      if (input.media) await this.replaceMedia(tx, id, input.media, bySku);

      const scalarChanges = diff(
        before as unknown as Record<string, unknown>,
        Object.fromEntries(scalarFields.map((f) => [f, input[f]])),
      );
      await this.audit.record(
        actor,
        {
          action: 'product.update',
          entityType: 'product',
          entityId: id,
          changes: {
            ...scalarChanges,
            replaced: (['categoryIds', 'tags', 'attributes', 'media'] as const).filter(
              (f) => input[f] !== undefined,
            ),
          },
        },
        tx,
      );
    });
    return this.get(id);
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      const product = await this.lockProduct(tx, id);
      const ordered = await tx.orderItem.count({ where: { productId: id } });
      const reserved = await tx.inventoryItem.count({
        where: { variant: { productId: id }, reserved: { gt: 0 } },
      });
      if (ordered > 0) {
        throw conflict(
          'PRODUCT_HAS_ORDERS',
          'This product has been ordered, so it is kept for order history. Archive it instead.',
        );
      }
      if (reserved > 0) {
        throw conflict('STOCK_RESERVED', 'Customers are checking out with this product right now.');
      }
      await tx.product.delete({ where: { id } });
      await this.audit.record(
        actor,
        {
          action: 'product.delete',
          entityType: 'product',
          entityId: id,
          changes: { name: product.name, slug: product.slug },
        },
        tx,
      );
    });
  }

  // ─── Variants ───

  async createVariant(productId: string, input: CreateVariantInput, actor: AuditActor) {
    await this.write(async (tx) => {
      await this.lockProduct(tx, productId);
      const siblings = await this.variantOptions(tx, productId);
      const all: VariantOptions[] = [
        ...siblings,
        { path: '', sku: input.sku, options: input.options ?? [] },
      ];
      await this.checkOptions(tx, all);
      await this.assertSkusFree(tx, [input.sku]);
      const position = siblings.length;
      const ids = await this.createVariants(tx, productId, [input], actor, position);
      await this.touch(tx, productId);
      await this.audit.record(
        actor,
        {
          action: 'variant.create',
          entityType: 'product',
          entityId: productId,
          changes: { sku: input.sku, variantId: ids.get(input.sku), priceMinor: input.priceMinor },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
    actor: AuditActor,
  ) {
    await this.write(async (tx) => {
      const product = await this.lockProduct(tx, productId);
      const before = await tx.productVariant.findFirst({
        where: { id: variantId, productId },
        select: {
          sku: true,
          title: true,
          priceMinor: true,
          compareAtPriceMinor: true,
          costMinor: true,
          barcode: true,
          weightGrams: true,
          isActive: true,
          position: true,
        },
      });
      if (!before) throw variantNotFound();

      const price = input.priceMinor ?? before.priceMinor;
      const compareAt =
        input.compareAtPriceMinor === undefined
          ? before.compareAtPriceMinor
          : input.compareAtPriceMinor;
      if (compareAt !== null && compareAt <= price) {
        throw new ValidationFailedException([
          {
            path: input.compareAtPriceMinor === undefined ? 'priceMinor' : 'compareAtPriceMinor',
            message: 'The "was" price must stay higher than the price. Clear it to end the sale.',
          },
        ]);
      }
      if (input.options) {
        const siblings = await this.variantOptions(tx, productId);
        await this.checkOptions(
          tx,
          siblings.map((s) =>
            s.variantId === variantId ? { path: '', sku: s.sku, options: input.options ?? [] } : s,
          ),
        );
      }
      if (input.isActive === false && before.isActive && product.status === 'ACTIVE') {
        const othersActive = await tx.productVariant.count({
          where: { productId, isActive: true, id: { not: variantId } },
        });
        if (othersActive === 0) {
          throw conflict(
            'LAST_ACTIVE_VARIANT',
            'This is the only active variant of a live product. Archive the product instead.',
          );
        }
      }
      if (input.sku && input.sku !== before.sku) await this.assertSkusFree(tx, [input.sku]);

      const { options, ...fields } = input;
      await tx.productVariant.update({
        where: { id: variantId },
        data: fields,
        select: { id: true },
      });
      if (options) {
        await tx.variantOptionValue.deleteMany({ where: { variantId } });
        await tx.variantOptionValue.createMany({ data: options.map((o) => ({ variantId, ...o })) });
      }
      await this.touch(tx, productId);
      await this.audit.record(
        actor,
        {
          action: 'variant.update',
          entityType: 'product',
          entityId: productId,
          changes: {
            variantId,
            sku: before.sku,
            ...diff(before, fields),
            ...(options ? { optionsReplaced: true } : {}),
          },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  async removeVariant(productId: string, variantId: string, actor: AuditActor) {
    await this.write(async (tx) => {
      await this.lockProduct(tx, productId);
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId },
        select: {
          sku: true,
          inventory: { select: { reserved: true } },
          _count: { select: { orderItems: true } },
        },
      });
      if (!variant) throw variantNotFound();
      if (variant._count.orderItems > 0) {
        throw conflict(
          'VARIANT_HAS_ORDERS',
          'This variant has been ordered, so it is kept for order history. Deactivate it instead.',
        );
      }
      if ((variant.inventory?.reserved ?? 0) > 0) {
        throw conflict('STOCK_RESERVED', 'Customers are checking out with this variant right now.');
      }
      const remaining = await tx.productVariant.count({
        where: { productId, id: { not: variantId } },
      });
      if (remaining === 0) {
        throw conflict(
          'LAST_VARIANT',
          'A product needs at least one variant. Delete the product instead.',
        );
      }
      await tx.productVariant.delete({ where: { id: variantId } });
      await this.touch(tx, productId);
      await this.audit.record(
        actor,
        {
          action: 'variant.delete',
          entityType: 'product',
          entityId: productId,
          changes: { variantId, sku: variant.sku },
        },
        tx,
      );
    });
    return this.get(productId);
  }

  // ─── Helpers ───

  /** Runs a write transaction, maps unique violations, then drops the storefront cache. */
  private async write<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    let result: T;
    try {
      result = await this.prisma.$transaction(work, { timeout: 20_000 });
    } catch (error) {
      translateUniqueViolation(error);
    }
    await this.catalog.invalidate();
    return result;
  }

  /**
   * Locks the product row for this transaction. With `expectedUpdatedAt`, refuses if someone
   * saved since the caller read it.
   */
  private async lockProduct(tx: Tx, id: string, expectedUpdatedAt?: Date) {
    const locked = await tx.$executeRaw`SELECT 1 FROM products WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked) throw productNotFound();
    const product = await tx.product.findUniqueOrThrow({
      where: { id },
      select: {
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        status: true,
        primaryCategoryId: true,
        brandId: true,
        specifications: true,
        sizeGuide: true,
        isFeatured: true,
        isBestseller: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    if (expectedUpdatedAt && product.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'STALE_UPDATE',
        'Someone else saved this product since you opened it. Reload to see their changes.',
        { extensions: { updatedAt: product.updatedAt.toISOString() } },
      );
    }
    return product;
  }

  private touch(tx: Tx, id: string) {
    return tx.product.update({
      where: { id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
  }

  private async checkReferences(
    tx: Tx,
    input: {
      primaryCategoryId?: string | undefined;
      categoryIds?: string[] | undefined;
      brandId?: string | null | undefined;
      media?: MediaInput[] | undefined;
    },
    errors: FieldError[],
  ) {
    const categoryIds = [
      ...new Set([
        ...(input.categoryIds ?? []),
        ...(input.primaryCategoryId ? [input.primaryCategoryId] : []),
      ]),
    ];
    if (categoryIds.length) {
      const found = new Set(
        (
          await tx.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } })
        ).map((c) => c.id),
      );
      if (input.primaryCategoryId && !found.has(input.primaryCategoryId)) {
        errors.push({ path: 'primaryCategoryId', message: 'Unknown category.' });
      }
      input.categoryIds?.forEach((id, i) => {
        if (!found.has(id))
          errors.push({ path: `categoryIds.${String(i)}`, message: 'Unknown category.' });
      });
    }
    if (
      input.brandId &&
      !(await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }))
    ) {
      errors.push({ path: 'brandId', message: 'Unknown brand.' });
    }
    if (input.media?.length) {
      const found = new Set(
        (
          await tx.media.findMany({
            where: { id: { in: input.media.map((m) => m.mediaId) }, visibility: 'PUBLIC' },
            select: { id: true },
          })
        ).map((m) => m.id),
      );
      input.media.forEach((m, i) => {
        if (!found.has(m.mediaId)) {
          errors.push({ path: `media.${String(i)}.mediaId`, message: 'Unknown image.' });
        }
      });
    }
  }

  private async attributeDefs(tx: Tx, ids: string[]): Promise<Map<string, AttributeDef>> {
    if (!ids.length) return new Map();
    const rows = await tx.attribute.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, type: true, scope: true, values: { select: { id: true } } },
    });
    return new Map(rows.map((a) => [a.id, { ...a, valueIds: new Set(a.values.map((v) => v.id)) }]));
  }

  private async variantOptions(tx: Tx, productId: string) {
    const variants = await tx.productVariant.findMany({
      where: { productId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, sku: true, options: { select: { attributeId: true, valueId: true } } },
    });
    return variants.map((v) => ({
      variantId: v.id,
      path: `variant ${v.sku}`,
      sku: v.sku,
      options: v.options,
    }));
  }

  private async checkOptions(tx: Tx, variants: VariantOptions[]) {
    const defs = await this.attributeDefs(
      tx,
      variants.flatMap((v) => v.options.map((o) => o.attributeId)),
    );
    const errors = checkVariantOptions(variants, defs);
    if (errors.length) throw new ValidationFailedException(errors);
  }

  private async assertSkusFree(tx: Tx, skus: string[]) {
    const taken = await tx.productVariant.findFirst({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    if (taken) {
      throw conflict('SKU_TAKEN', `SKU ${taken.sku} is already used by another variant.`, {
        sku: taken.sku,
      });
    }
  }

  private async freeSlug(tx: Tx, name: string) {
    const base = slugify(name) || 'product';
    const taken = await tx.product.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return uniqueSlug(base, new Set(taken.map((p) => p.slug)));
  }

  /** Creates variants with their options, stock rows and initial-stock movements. */
  private async createVariants(
    tx: Tx,
    productId: string,
    inputs: CreateVariantInput[],
    actor: AuditActor,
    firstPosition: number,
  ): Promise<Map<string, string>> {
    const created = await tx.productVariant.createManyAndReturn({
      data: inputs.map((v, i) => ({
        productId,
        sku: v.sku,
        title: v.title ?? null,
        priceMinor: v.priceMinor,
        compareAtPriceMinor: v.compareAtPriceMinor ?? null,
        costMinor: v.costMinor ?? null,
        barcode: v.barcode ?? null,
        weightGrams: v.weightGrams ?? null,
        isActive: v.isActive ?? true,
        position: firstPosition + i,
      })),
      select: { id: true, sku: true },
    });
    const idBySku = new Map(created.map((v) => [v.sku, v.id]));
    const rows = inputs.map((input) => ({ input, variantId: idBySku.get(input.sku) ?? '' }));
    await tx.variantOptionValue.createMany({
      data: rows.flatMap(({ input, variantId }) =>
        (input.options ?? []).map((o) => ({ variantId, ...o })),
      ),
    });
    await tx.inventoryItem.createMany({
      data: rows.map(({ input, variantId }) => ({ variantId, ...input.inventory })),
    });
    await tx.inventoryMovement.createMany({
      data: rows
        .filter(({ input }) => input.inventory.onHand > 0)
        .map(({ input, variantId }) => ({
          variantId,
          delta: input.inventory.onHand,
          reason: 'RESTOCK' as const,
          note: 'Initial stock',
          actorStaffId: actor.staffId,
        })),
    });
    return idBySku;
  }

  private async replaceCategories(tx: Tx, productId: string, primaryId: string, extra: string[]) {
    await tx.productCategory.deleteMany({ where: { productId } });
    await tx.productCategory.createMany({
      data: extra
        .filter((id) => id !== primaryId)
        .map((categoryId, position) => ({ productId, categoryId, position })),
    });
  }

  private async replaceTags(tx: Tx, productId: string, names: string[]) {
    const tags = new Map<string, string>();
    names.forEach((name, i) => {
      const slug = slugify(name, 80);
      if (!slug) {
        throw new ValidationFailedException([
          { path: `tags.${String(i)}`, message: 'Tags need at least one letter or digit.' },
        ]);
      }
      if (!tags.has(slug)) tags.set(slug, name);
    });
    await tx.productTag.deleteMany({ where: { productId } });
    if (!tags.size) return;
    await tx.tag.createMany({
      data: [...tags].map(([slug, name]) => ({ slug, name })),
      skipDuplicates: true,
    });
    const rows = await tx.tag.findMany({
      where: { slug: { in: [...tags.keys()] } },
      select: { id: true },
    });
    await tx.productTag.createMany({ data: rows.map((t) => ({ productId, tagId: t.id })) });
  }

  private async replaceMedia(
    tx: Tx,
    productId: string,
    media: MediaInput[],
    variantIdBySku: ReadonlyMap<string, string>,
  ) {
    await tx.productMedia.deleteMany({ where: { productId } });
    await tx.productMedia.createMany({
      data: media.map((m, position) => ({
        productId,
        mediaId: m.mediaId,
        alt: m.alt ?? null,
        variantId: m.variantSku ? (variantIdBySku.get(m.variantSku) ?? null) : null,
        position,
      })),
    });
  }

  /** Products with an active, tracked variant at or below its low-stock threshold. */
  private async lowStockProductIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ product_id: string }[]>`
      SELECT DISTINCT v.product_id
      FROM product_variants v JOIN inventory_items i ON i.variant_id = v.id
      WHERE v.is_active AND i.track_inventory AND i.on_hand - i.reserved <= i.low_stock_threshold`;
    return rows.map((r) => r.product_id);
  }
}

const variantNotFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'Variant not found.');
