import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { CategorySlug } from '@/config/catalog';

import { mockProducts } from '../data';
import { isInStock, toSummary } from '../lib/product-helpers';
import {
  computeFacets,
  filterBase,
  filterProducts,
  paginate,
  sortProducts,
} from '../lib/query-products';
import { type CatalogQuery, PAGE_SIZE } from '../schemas';
import type {
  CatalogFacets,
  Paginated,
  Product,
  ProductSummary,
  VariantDetail,
  VariantSnapshot,
} from '../types';
import type { CatalogService } from './catalog.service';
import { CATALOG_TAG } from './tags';

/*
 * Adapter: in-memory mock catalog (`MOCK_API=true`, offline development).
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

async function getProductSummariesBySlug(slugs: readonly string[]): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const bySlug = new Map(mockProducts.map((p) => [p.slug, p]));
  return slugs.flatMap((slug) => {
    const product = bySlug.get(slug);
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

async function getNewArrivals(limit = 8): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  return sortProducts(
    mockProducts.filter((p) => isInStock(p)),
    'newest',
  )
    .slice(0, limit)
    .map((p) => toSummary(p));
}

async function getBestSellers(category: CategorySlug, limit = 4): Promise<ProductSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CATALOG_TAG);
  const inCategory = sortProducts(
    mockProducts.filter((p) => p.category === category),
    'rating',
  );
  // In stock first, then bestsellers; the stable sort keeps the rating order inside each group.
  const rank = (p: Product) => (isInStock(p) ? 2 : 0) + (p.bestseller ? 1 : 0);
  return [...inCategory]
    .sort((a, b) => rank(b) - rank(a))
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
async function getVariantDetails(variantIds: readonly string[]): Promise<VariantDetail[]> {
  const wanted = new Set(variantIds);
  return mockProducts.flatMap((p) =>
    p.variants
      .filter((v) => wanted.has(v.id))
      .map((v) => ({
        variantId: v.id,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        stock: v.stock,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        sku: v.sku,
        options: v.options,
        image: p.images[0] ?? { src: '/images/hero-model.jpg', alt: p.name },
      })),
  );
}

async function getVariantSnapshots(variantIds: readonly string[]): Promise<VariantSnapshot[]> {
  return (await getVariantDetails(variantIds)).map(
    ({ variantId, price, compareAtPrice, stock }) => ({ variantId, price, compareAtPrice, stock }),
  );
}

export const mockCatalogService: CatalogService = {
  getVariantSnapshots,
  getVariantDetails,
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
};
