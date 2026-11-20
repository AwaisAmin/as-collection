import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CacheService, hashKey } from '../../redis/cache.service.js';
import {
  productDetailSelect,
  productSummarySelect,
  toImage,
  toProductDetail,
  toProductSummary,
  toVariant,
} from './catalog.mapper.js';
import type { FacetsQuery, ProductListQuery } from './catalog.schemas.js';
import type {
  AttributeFacetDto,
  CategoryDetailDto,
  CategoryNodeDto,
  CategoryRefDto,
  CollectionDto,
  FacetsDto,
  Paginated,
  ProductDetailDto,
  ProductSummaryDto,
  VariantSnapshotDto,
} from './catalog.types.js';
import {
  type AttributeRef,
  collectionRulesSchema,
  productOrderBy,
  type ProductQueryContext,
  productWhere,
  type ResolvedCollection,
  visibleProduct,
} from './product-query.js';

/** Cache namespace for every catalog read. Admin writes call `invalidate()` (B7). */
export const CATALOG_CACHE = 'catalog';

interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  path: string;
  position: number;
  image: CategoryNodeDto['image'];
  banner: CategoryDetailDto['banner'];
  seo: CategoryDetailDto['seo'];
  /** Filterable attributes assigned directly to this category. */
  filters: CategoryDetailDto['filters'];
}

interface CatalogIndex {
  categories: CategoryRecord[];
  attributes: Record<
    string,
    AttributeRef & { name: string; position: number; isFilterable: boolean }
  >;
}

const bannerSchema = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { eyebrow?: string; description?: string; focus?: string })
    : null;

@Injectable()
export class CatalogService {
  private readonly ttl: number;
  private readonly mediaBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.ttl = config.get('CATALOG_CACHE_TTL_SECONDS', { infer: true });
    this.mediaBaseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  /** Every catalog cache entry becomes stale at once (call after any catalog write). */
  invalidate(): Promise<void> {
    return this.cache.invalidate(CATALOG_CACHE);
  }

  // ─── Categories ───

  async categoryTree(): Promise<CategoryNodeDto[]> {
    return this.cached('categories:tree', async () => {
      const { categories } = await this.index();
      const children = Map.groupBy(categories, (c) => c.parentId ?? 'root');
      const build = (parentId: string): CategoryNodeDto[] =>
        (children.get(parentId) ?? []).map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          image: c.image,
          children: build(c.id),
        }));
      return build('root');
    });
  }

  async categoryDetail(slug: string): Promise<CategoryDetailDto> {
    const detail = await this.cached(`categories:${slug}`, async () => {
      const { categories } = await this.index();
      const category = categories.find((c) => c.slug === slug);
      if (!category) return null;
      const ancestors = this.ancestorsOf(category, categories);
      // Filters inherited from ancestors first, de-duplicated by code.
      const filters = new Map<string, CategoryDetailDto['filters'][number]>();
      for (const c of [...ancestors, category]) for (const f of c.filters) filters.set(f.code, f);
      return {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        image: category.image,
        banner: category.banner,
        breadcrumbs: ancestors.map((c) => ({ slug: c.slug, name: c.name })),
        children: categories
          .filter((c) => c.parentId === category.id)
          .map((c) => ({ slug: c.slug, name: c.name })),
        filters: [...filters.values()],
        seo: category.seo,
      } satisfies CategoryDetailDto;
    });
    if (!detail) throw new NotFoundException('Category not found.');
    return detail;
  }

  // ─── Collections ───

  async collections(): Promise<CollectionDto[]> {
    return this.cached('collections', async () => {
      const now = new Date();
      const rows = await this.prisma.collection.findMany({
        where: this.liveCollection(now),
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          description: true,
          type: true,
          endsAt: true,
          image: { select: { storageKey: true, alt: true, width: true, height: true } },
        },
      });
      return rows.map((c) => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        type: c.type,
        endsAt: c.endsAt?.toISOString() ?? null,
        image: c.image ? toImage(this.mediaBaseUrl, c.image, null, c.name) : null,
      }));
    });
  }

  async collection(slug: string): Promise<CollectionDto> {
    const found = (await this.collections()).find((c) => c.slug === slug);
    if (!found) throw new NotFoundException('Collection not found.');
    return found;
  }

  // ─── Products ───

  async listProducts(query: ProductListQuery): Promise<Paginated<ProductSummaryDto>> {
    return this.cached(`products:${hashKey(query)}`, async () => {
      const now = new Date();
      const where = productWhere(query, await this.queryContext(query, now));
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          orderBy: productOrderBy(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: productSummarySelect,
        }),
      ]);
      return {
        items: rows.map((row) => toProductSummary(row, this.mediaBaseUrl, now)),
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    });
  }

  async productDetail(slug: string): Promise<ProductDetailDto> {
    const detail = await this.cached(`product:${slug}`, async () => {
      const now = new Date();
      const row = await this.prisma.product.findFirst({
        where: { slug, ...visibleProduct(now) },
        select: productDetailSelect,
      });
      if (!row) return null;
      const { categories } = await this.index();
      const primary = categories.find((c) => c.path === row.primaryCategory.path);
      const breadcrumbs: CategoryRefDto[] = primary
        ? [...this.ancestorsOf(primary, categories), primary].map((c) => ({
            slug: c.slug,
            name: c.name,
          }))
        : [{ slug: row.primaryCategory.slug, name: row.primaryCategory.name }];
      return toProductDetail(row, this.mediaBaseUrl, now, breadcrumbs);
    });
    if (!detail) throw new NotFoundException('Product not found.');
    return detail;
  }

  /** Same category, ranked by shared tags, then the usual "featured" order. */
  async relatedProducts(slug: string, limit: number): Promise<ProductSummaryDto[]> {
    return this.cached(`related:${slug}:${limit}`, async () => {
      const now = new Date();
      const product = await this.prisma.product.findFirst({
        where: { slug, ...visibleProduct(now) },
        select: { id: true, primaryCategoryId: true, tags: { select: { tagId: true } } },
      });
      if (!product) throw new NotFoundException('Product not found.');
      const tagIds = new Set(product.tags.map((t) => t.tagId));
      const candidates = await this.prisma.product.findMany({
        where: {
          ...visibleProduct(now),
          primaryCategoryId: product.primaryCategoryId,
          id: { not: product.id },
        },
        orderBy: productOrderBy('featured'),
        take: limit * 4,
        select: { ...productSummarySelect, tags: { select: { tagId: true } } },
      });
      const shared = (c: (typeof candidates)[number]) =>
        c.tags.filter((t) => tagIds.has(t.tagId)).length;
      return candidates
        .map((c, order) => ({ c, order, score: shared(c) }))
        .sort((a, b) => b.score - a.score || a.order - b.order)
        .slice(0, limit)
        .map(({ c }) => toProductSummary(c, this.mediaBaseUrl, now));
    });
  }

  async facets(query: FacetsQuery): Promise<FacetsDto> {
    return this.cached(`facets:${hashKey(query)}`, async () => {
      const now = new Date();
      const listQuery = {
        q: query.q,
        attributes: {},
        tags: [],
        inStock: false,
        sale: false,
        min: undefined,
        max: undefined,
      };
      const ctx = await this.queryContext(
        { category: query.category, collections: query.collection ? [query.collection] : [] },
        now,
      );
      const products = await this.prisma.product.findMany({
        where: productWhere(listQuery, ctx),
        select: { id: true, priceMinMinor: true },
      });
      const ids = products.map((p) => p.id);
      const prices = products.map((p) => p.priceMinMinor).filter((p): p is number => p !== null);
      const allowedCodes = query.category
        ? new Set((await this.categoryDetail(query.category)).filters.map((f) => f.code))
        : null;

      return {
        total: ids.length,
        priceRange: {
          minMinor: prices.length ? Math.min(...prices) : 0,
          maxMinor: prices.length ? Math.max(...prices) : 0,
        },
        attributes: ids.length ? await this.attributeFacets(ids, allowedCodes) : [],
        collections: ids.length ? await this.collectionFacets(ids, now) : [],
      };
    });
  }

  /** Fresh (uncached) price and availability — cart validation and checkout must never be stale. */
  async variantSnapshots(ids: readonly string[]): Promise<VariantSnapshotDto[]> {
    const now = new Date();
    const rows = await this.prisma.productVariant.findMany({
      where: { id: { in: [...ids] } },
      select: {
        ...productDetailSelect.variants.select,
        isActive: true,
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            publishedAt: true,
            media: {
              orderBy: { position: 'asc' },
              take: 1,
              select: {
                alt: true,
                media: { select: { storageKey: true, alt: true, width: true, height: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => {
      const { product } = row;
      const visible =
        product.status === 'ACTIVE' && product.publishedAt !== null && product.publishedAt <= now;
      const variant = toVariant(row);
      const image = product.media[0];
      return {
        variantId: row.id,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        sku: row.sku,
        title: row.title,
        options: variant.options,
        optionLabels: Object.fromEntries(
          row.options
            .toSorted((a, b) => a.attribute.position - b.attribute.position)
            .map((o) => [o.attribute.name, o.value.label]),
        ),
        priceMinor: row.priceMinor,
        compareAtPriceMinor: row.compareAtPriceMinor,
        availableQuantity: visible && row.isActive ? variant.availableQuantity : 0,
        purchasable: visible && row.isActive,
        image: image ? toImage(this.mediaBaseUrl, image.media, image.alt, product.name) : null,
      };
    });
  }

  // ─── Internals ───

  private cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(CATALOG_CACHE, key, this.ttl, loader);
  }

  private liveCollection(now: Date): Prisma.CollectionWhereInput {
    return {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    };
  }

  /** Active categories + attribute registry, cached together (small, read on every listing). */
  private index(): Promise<CatalogIndex> {
    return this.cached('index', async () => {
      const [categories, attributes] = await Promise.all([
        this.prisma.category.findMany({
          where: { isActive: true },
          orderBy: [{ depth: 'asc' }, { position: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            parentId: true,
            path: true,
            position: true,
            banner: true,
            seoTitle: true,
            seoDescription: true,
            image: { select: { storageKey: true, alt: true, width: true, height: true } },
            bannerImage: { select: { storageKey: true, alt: true, width: true, height: true } },
            attributes: {
              where: { attribute: { isFilterable: true } },
              orderBy: { position: 'asc' },
              select: { attribute: { select: { code: true, name: true, scope: true } } },
            },
          },
        }),
        this.prisma.attribute.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            scope: true,
            position: true,
            isFilterable: true,
          },
        }),
      ]);
      return {
        categories: categories.map((c) => {
          const banner = bannerSchema(c.banner);
          return {
            id: c.id,
            slug: c.slug,
            name: c.name,
            description: c.description,
            parentId: c.parentId,
            path: c.path,
            position: c.position,
            image: c.image ? toImage(this.mediaBaseUrl, c.image, null, c.name) : null,
            banner: banner
              ? {
                  ...banner,
                  image: c.bannerImage
                    ? toImage(this.mediaBaseUrl, c.bannerImage, null, c.name)
                    : null,
                }
              : null,
            seo: { title: c.seoTitle, description: c.seoDescription },
            filters: c.attributes.map(({ attribute }) => attribute),
          };
        }),
        attributes: Object.fromEntries(
          attributes.map((a) => [
            a.code,
            {
              id: a.id,
              scope: a.scope,
              name: a.name,
              position: a.position,
              isFilterable: a.isFilterable,
            },
          ]),
        ),
      };
    });
  }

  private ancestorsOf(category: CategoryRecord, all: readonly CategoryRecord[]): CategoryRecord[] {
    const ids = category.path.split('/').filter(Boolean).slice(0, -1);
    return ids.flatMap((id) => all.filter((c) => c.id === id));
  }

  private async queryContext(
    query: Pick<ProductListQuery, 'category' | 'collections'>,
    now: Date,
  ): Promise<ProductQueryContext> {
    const { categories, attributes } = await this.index();
    let categoryPath: string | undefined;
    if (query.category) {
      const category = categories.find((c) => c.slug === query.category);
      if (!category) throw new NotFoundException('Category not found.');
      categoryPath = category.path;
    }
    return {
      categoryPath,
      attributes: new Map(Object.entries(attributes).filter(([, a]) => a.isFilterable)),
      collections: query.collections.length
        ? await this.resolveCollections(query.collections, now)
        : [],
      reservedField: this.prisma.inventoryItem.fields.reserved,
      now,
    };
  }

  private async resolveCollections(
    slugs: readonly string[],
    now: Date,
  ): Promise<ResolvedCollection[]> {
    const rows = await this.prisma.collection.findMany({
      where: { slug: { in: [...slugs] }, ...this.liveCollection(now) },
      select: { id: true, type: true, rules: true },
    });
    if (rows.length === 0) throw new NotFoundException('Collection not found.');
    return rows.flatMap((c): ResolvedCollection[] => {
      if (c.type === 'MANUAL') return [{ type: 'MANUAL', id: c.id }];
      const rules = collectionRulesSchema.safeParse(c.rules);
      return rules.success ? [{ type: 'AUTOMATED', rules: rules.data }] : [];
    });
  }

  private async attributeFacets(
    ids: readonly string[],
    allowedCodes: ReadonlySet<string> | null,
  ): Promise<AttributeFacetDto[]> {
    const rows = await this.prisma.$queryRaw<
      {
        code: string;
        name: string;
        scope: 'PRODUCT' | 'VARIANT';
        value: string;
        label: string;
        swatch: string | null;
        count: number;
      }[]
    >(Prisma.sql`
      SELECT a.code, a.name, a.scope::text AS scope, v.value, v.label, v.swatch,
             count(DISTINCT pav.product_id)::int AS count, a.position AS apos, v.position AS vpos
      FROM product_attribute_values pav
      JOIN attributes a ON a.id = pav.attribute_id AND a.is_filterable
      JOIN attribute_values v ON v.id = pav.value_id
      WHERE pav.product_id = ANY(${ids}::uuid[])
      GROUP BY a.id, v.id
      UNION ALL
      SELECT a.code, a.name, a.scope::text AS scope, v.value, v.label, v.swatch,
             count(DISTINCT pv.product_id)::int AS count, a.position AS apos, v.position AS vpos
      FROM variant_option_values vov
      JOIN product_variants pv ON pv.id = vov.variant_id AND pv.is_active
      JOIN attributes a ON a.id = vov.attribute_id AND a.is_filterable
      JOIN attribute_values v ON v.id = vov.value_id
      WHERE pv.product_id = ANY(${ids}::uuid[])
      GROUP BY a.id, v.id
      ORDER BY apos, vpos`);

    const facets = new Map<string, AttributeFacetDto>();
    for (const row of rows) {
      if (allowedCodes && !allowedCodes.has(row.code)) continue;
      const facet = facets.get(row.code) ?? {
        code: row.code,
        name: row.name,
        scope: row.scope,
        values: [],
      };
      facet.values.push({
        value: row.value,
        label: row.label,
        swatch: row.swatch,
        count: row.count,
      });
      facets.set(row.code, facet);
    }
    return [...facets.values()];
  }

  private async collectionFacets(
    ids: readonly string[],
    now: Date,
  ): Promise<FacetsDto['collections']> {
    return this.prisma.$queryRaw<FacetsDto['collections']>(Prisma.sql`
      SELECT c.slug, c.name, count(DISTINCT cp.product_id)::int AS count
      FROM collection_products cp
      JOIN collections c ON c.id = cp.collection_id
      WHERE cp.product_id = ANY(${ids}::uuid[])
        AND c.is_active
        AND (c.starts_at IS NULL OR c.starts_at <= ${now})
        AND (c.ends_at IS NULL OR c.ends_at > ${now})
      GROUP BY c.id
      ORDER BY c.position, c.name`);
  }
}
