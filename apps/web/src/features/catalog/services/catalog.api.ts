import 'server-only';

import type {
  FacetsDto,
  Paginated as PaginatedDto,
  ProductDetailDto,
  ProductSummaryDto,
  VariantSnapshotDto,
} from '@as/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import type { CategorySlug } from '@/config/catalog';
import { env } from '@/config/env';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';

import { type CatalogQuery, PAGE_SIZE } from '../schemas';
import type { CatalogFacets, Paginated, Product, ProductSummary, VariantDetail } from '../types';
import {
  optionIndex,
  type OptionValueIndex,
  toFacets,
  toListParams,
  toProduct,
  toSummary,
  toVariantDetail,
} from './api-mappers';
import type { CatalogService } from './catalog.service';
import { CATALOG_TAG } from './tags';

/*
 * Adapter: the NestJS catalog API. Reads are `'use cache'` scopes tagged CATALOG_TAG and kept
 * for minutes (the API caches too and invalidates on every admin edit); stock lookups for the
 * cart and checkout are never cached.
 */

const SITE_ORIGIN = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
/** The API's largest page; also the batch size for id / slug lookups. */
const MAX_PAGE = 48;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

const list = (query: Record<string, unknown>) =>
  apiRequest<PaginatedDto<ProductSummaryDto>>('/catalog/products', {
    query: query as Record<string, string>,
  });

/** Option label → value slug, from catalog-wide facets (filters keep labels in the URL). */
async function optionValueIndex(): Promise<Record<string, OptionValueIndex>> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  return optionIndex(await apiRequest<FacetsDto>('/catalog/facets'));
}

async function listProducts(
  query: CatalogQuery,
  pageSize = PAGE_SIZE,
): Promise<Paginated<ProductSummary>> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  const params = toListParams(query, Math.min(pageSize, MAX_PAGE), await optionValueIndex());
  const page = await list(params);
  return { ...page, items: page.items.map((p) => toSummary(p, SITE_ORIGIN)) };
}

async function getFacets(query: Pick<CatalogQuery, 'category' | 'q'>): Promise<CatalogFacets> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  return toFacets(
    await apiRequest<FacetsDto>('/catalog/facets', {
      query: { category: query.category, q: query.q || undefined },
    }),
  );
}

async function getProductBySlug(slug: string): Promise<Product | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG, `product:${slug}`);
  const dto = await apiFindOrNull<ProductDetailDto>(
    `/catalog/products/${encodeURIComponent(slug)}`,
  );
  return dto ? toProduct(dto, SITE_ORIGIN) : null;
}

/** Products by exact key, in the caller's order (missing or hidden ones skipped). */
async function byKeys(key: 'ids' | 'slugs', values: readonly string[]): Promise<ProductSummary[]> {
  const found = new Map<string, ProductSummary>();
  for (const batch of chunks([...new Set(values)], MAX_PAGE)) {
    const page = await list({ [key]: batch, pageSize: MAX_PAGE });
    for (const dto of page.items)
      found.set(key === 'ids' ? dto.id : dto.slug, toSummary(dto, SITE_ORIGIN));
  }
  return values.flatMap((v) => {
    const summary = found.get(v);
    return summary ? [summary] : [];
  });
}

async function getProductSummaries(ids: readonly string[]): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  // Wishlists and recently-viewed lists live in the browser and may hold stale ids.
  return byKeys(
    'ids',
    ids.filter((id) => UUID.test(id)),
  );
}

async function getProductSummariesBySlug(slugs: readonly string[]): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  return byKeys(
    'slugs',
    slugs.filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  );
}

async function getRelatedProducts(product: Product, limit = 4): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  const items = await apiRequest<ProductSummaryDto[]>(
    `/catalog/products/${encodeURIComponent(product.slug)}/related`,
    { query: { limit } },
  ).catch(() => []);
  return items.map((p) => toSummary(p, SITE_ORIGIN));
}

async function getFeaturedProducts(limit = 8): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  const page = await list({ sort: 'featured', pageSize: Math.min(limit, MAX_PAGE) });
  return page.items.map((p) => toSummary(p, SITE_ORIGIN));
}

async function getNewArrivals(limit = 8): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  const page = await list({ sort: 'newest', inStock: true, pageSize: Math.min(limit, MAX_PAGE) });
  return page.items.map((p) => toSummary(p, SITE_ORIGIN));
}

async function getBestSellers(category: CategorySlug, limit = 4): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  // "featured" ranks bestsellers and in-stock products first.
  const page = await list({ category, sort: 'featured', pageSize: Math.min(limit, MAX_PAGE) });
  return page.items.map((p) => toSummary(p, SITE_ORIGIN));
}

async function listProductSlugs(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const slugs: string[] = [];
  for (let page = 1; ; page += 1) {
    const result = await list({ sort: 'newest', page, pageSize: MAX_PAGE });
    slugs.push(...result.items.map((p) => p.slug));
    if (page >= result.pageCount) return slugs;
  }
}

/** Deliberately NOT cached: stock must be current when the shopper reviews the cart. */
async function getVariantDetails(variantIds: readonly string[]): Promise<VariantDetail[]> {
  const ids = [...new Set(variantIds)].filter((id) => UUID.test(id));
  const details: VariantDetail[] = [];
  for (const batch of chunks(ids, 50)) {
    const rows = await apiRequest<VariantSnapshotDto[]>('/catalog/variants', {
      query: { ids: batch },
    });
    details.push(...rows.map((row) => toVariantDetail(row, SITE_ORIGIN)));
  }
  return details;
}

export const apiCatalogService: CatalogService = {
  listProducts,
  getFacets,
  getProductBySlug,
  getProductSummaries,
  getProductSummariesBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  listProductSlugs,
  getVariantDetails,
  async getVariantSnapshots(variantIds) {
    return (await getVariantDetails(variantIds)).map(
      ({ variantId, price, compareAtPrice, stock }) => ({
        variantId,
        price,
        ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
        stock,
      }),
    );
  },
};
