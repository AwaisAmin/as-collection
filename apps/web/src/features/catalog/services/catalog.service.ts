import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { mockProducts } from '../data';
import { toSummary } from '../lib/product-helpers';
import {
  computeFacets,
  filterBase,
  filterProducts,
  paginate,
  sortProducts,
} from '../lib/query-products';
import { type CatalogQuery, PAGE_SIZE } from '../schemas';
import type { CatalogFacets, Paginated, Product, ProductSummary, VariantSnapshot } from '../types';

/** Cache tag for all catalog reads — the admin calls `revalidateTag(CATALOG_TAG)` after edits. */
export const CATALOG_TAG = 'catalog';

/** Port: everything the storefront needs from the catalog. */
export interface CatalogService {
  listProducts(query: CatalogQuery, pageSize?: number): Promise<Paginated<ProductSummary>>;
  getFacets(query: Pick<CatalogQuery, 'category' | 'q'>): Promise<CatalogFacets>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getProductSummaries(ids: readonly string[]): Promise<ProductSummary[]>;
  getRelatedProducts(product: Product, limit?: number): Promise<ProductSummary[]>;
  getFeaturedProducts(limit?: number): Promise<ProductSummary[]>;
  listProductSlugs(): Promise<string[]>;
  /** Fresh (uncached) price/stock per variant — for cart re-validation and checkout. */
  getVariantSnapshots(variantIds: readonly string[]): Promise<VariantSnapshot[]>;
}

/*
 * Adapter: in-memory mock catalog (replaced by the NestJS API adapter in the backend step).
 *
 * Every read is a `'use cache'` scope: results are computed once and refreshed hourly
 * (`hours` profile). Summaries depend on "now" (the New badge), which Next.js only allows
 * inside an explicit cache scope when prerendering with Cache Components.
 */

async function listProducts(
  query: CatalogQuery,
  pageSize = PAGE_SIZE,
): Promise<Paginated<ProductSummary>> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const sorted = sortProducts(filterProducts(mockProducts, query), query.sort);
  const page = paginate(sorted, query.page, pageSize);
  return { ...page, items: page.items.map((p) => toSummary(p)) };
}

async function getFacets(query: Pick<CatalogQuery, 'category' | 'q'>): Promise<CatalogFacets> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  return computeFacets(filterBase(mockProducts, query));
}

async function getProductBySlug(slug: string): Promise<Product | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG, `product:${slug}`);
  return mockProducts.find((p) => p.slug === slug) ?? null;
}

async function getProductSummaries(ids: readonly string[]): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const byId = new Map(mockProducts.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [toSummary(product)] : [];
  });
}

async function getRelatedProducts(product: Product, limit = 4): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const sameCategory = sortProducts(
    mockProducts.filter((p) => p.category === product.category && p.id !== product.id),
    'featured',
  );
  // Prefer products sharing tags, then fill with the rest of the category.
  const tags = new Set(product.tags);
  const shared = (p: Product) => p.tags.filter((t) => tags.has(t)).length;
  return [...sameCategory]
    .sort((a, b) => shared(b) - shared(a))
    .slice(0, limit)
    .map((p) => toSummary(p));
}

async function getFeaturedProducts(limit = 8): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  return sortProducts(
    mockProducts.filter((p) => p.featured),
    'featured',
  )
    .slice(0, limit)
    .map((p) => toSummary(p));
}

async function listProductSlugs(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  return mockProducts.map((p) => p.slug);
}

/** Deliberately NOT cached: stock must be current when the shopper reviews the cart. */
async function getVariantSnapshots(variantIds: readonly string[]): Promise<VariantSnapshot[]> {
  const wanted = new Set(variantIds);
  return mockProducts.flatMap((p) =>
    p.variants
      .filter((v) => wanted.has(v.id))
      .map((v) => ({
        variantId: v.id,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        stock: v.stock,
      })),
  );
}

export const catalogService: CatalogService = {
  getVariantSnapshots,
  listProducts,
  getFacets,
  getProductBySlug,
  getProductSummaries,
  getRelatedProducts,
  getFeaturedProducts,
  listProductSlugs,
};
