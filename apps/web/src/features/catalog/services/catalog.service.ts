import 'server-only';

import type { ProductSource } from '@as/contracts';

import type { CategorySlug } from '@/config/catalog';

import type { CatalogQuery } from '../schemas';
import type {
  CatalogFacets,
  Paginated,
  Product,
  ProductSummary,
  VariantDetail,
  VariantSnapshot,
} from '../types';
import { apiCatalogService } from './catalog.api';

export { CATALOG_TAG } from './tags';

/** Port: everything the storefront needs from the catalog. */
export interface CatalogService {
  listProducts(query: CatalogQuery, pageSize?: number): Promise<Paginated<ProductSummary>>;
  getFacets(query: Pick<CatalogQuery, 'category' | 'q'>): Promise<CatalogFacets>;
  getProductBySlug(slug: string): Promise<Product | null>;
  /** Summaries in the given id order; unknown or hidden products are skipped. */
  getProductSummaries(ids: readonly string[]): Promise<ProductSummary[]>;
  /** Summaries in the given slug order; unknown slugs are skipped (curated content). */
  getProductSummariesBySlug(slugs: readonly string[]): Promise<ProductSummary[]>;
  getRelatedProducts(product: Product, limit?: number): Promise<ProductSummary[]>;
  getFeaturedProducts(limit?: number): Promise<ProductSummary[]>;
  /** Newest in-stock products first (home "New Arrivals"). */
  getNewArrivals(limit?: number): Promise<ProductSummary[]>;
  /** Bestsellers of a category, topped up with its best-rated products. */
  getBestSellers(category: CategorySlug, limit?: number): Promise<ProductSummary[]>;
  listProductSlugs(): Promise<string[]>;
  /** Products for a page section's source (newest, bestsellers, on sale, a collection…). */
  getProductsBySource(source: ProductSource, limit: number): Promise<ProductSummary[]>;
  /** Fresh (uncached) price/stock per variant — for cart re-validation and checkout. */
  getVariantSnapshots(variantIds: readonly string[]): Promise<VariantSnapshot[]>;
  /** Fresh (uncached) snapshot + display data — used to build orders server-side. */
  getVariantDetails(variantIds: readonly string[]): Promise<VariantDetail[]>;
}

/** The NestJS catalog API. */
export const catalogService: CatalogService = apiCatalogService;
