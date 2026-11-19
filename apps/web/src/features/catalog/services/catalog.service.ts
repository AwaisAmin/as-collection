import 'server-only';

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
import type { CatalogFacets, Paginated, Product, ProductSummary } from '../types';

/** Port: everything the storefront needs from the catalog. */
export interface CatalogService {
  listProducts(query: CatalogQuery, pageSize?: number): Promise<Paginated<ProductSummary>>;
  getFacets(query: Pick<CatalogQuery, 'category' | 'q'>): Promise<CatalogFacets>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getProductSummaries(ids: readonly string[]): Promise<ProductSummary[]>;
  getRelatedProducts(product: Product, limit?: number): Promise<ProductSummary[]>;
  getFeaturedProducts(limit?: number): Promise<ProductSummary[]>;
  listProductSlugs(): Promise<string[]>;
}

/** Adapter: in-memory mock catalog (replaced by the NestJS API adapter in the backend step). */
const mockCatalogService: CatalogService = {
  async listProducts(query, pageSize = PAGE_SIZE) {
    const sorted = sortProducts(filterProducts(mockProducts, query), query.sort);
    const page = paginate(sorted, query.page, pageSize);
    return { ...page, items: page.items.map((p) => toSummary(p)) };
  },

  async getFacets(query) {
    return computeFacets(filterBase(mockProducts, query));
  },

  async getProductBySlug(slug) {
    return mockProducts.find((p) => p.slug === slug) ?? null;
  },

  async getProductSummaries(ids) {
    const byId = new Map(mockProducts.map((p) => [p.id, p]));
    return ids.flatMap((id) => {
      const product = byId.get(id);
      return product ? [toSummary(product)] : [];
    });
  },

  async getRelatedProducts(product, limit = 4) {
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
  },

  async getFeaturedProducts(limit = 8) {
    return sortProducts(
      mockProducts.filter((p) => p.featured),
      'featured',
    )
      .slice(0, limit)
      .map((p) => toSummary(p));
  },

  async listProductSlugs() {
    return mockProducts.map((p) => p.slug);
  },
};

export const catalogService: CatalogService = mockCatalogService;
