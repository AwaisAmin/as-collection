/**
 * Pure catalog query logic (filter → sort → paginate, facets).
 * Used by the mock service now; the API will implement the same semantics server-side.
 */
import type { CatalogQuery, ReviewSort } from '../schemas';
import type { CatalogFacets, FacetValue, Paginated, Product, Review } from '../types';
import { isInStock, minPrice } from './product-helpers';

type BaseFilter = Pick<CatalogQuery, 'category' | 'q'>;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Every search word must appear in the product's name, tags, category or description. */
export function matchesSearch(product: Product, q: string | undefined): boolean {
  if (!q) return true;
  const haystack = normalize(
    [product.name, product.category, product.shortDescription, ...product.tags].join(' '),
  );
  return normalize(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Category + search only (the "universe" that facets are computed from). */
export function filterBase(products: readonly Product[], { category, q }: BaseFilter): Product[] {
  return products.filter((p) => (!category || p.category === category) && matchesSearch(p, q));
}

function hasOptionInStock(product: Product, option: string, values: readonly string[]): boolean {
  if (values.length === 0) return true;
  return product.variants.some((v) => {
    const value = v.options[option];
    return v.stock > 0 && value !== undefined && values.includes(value);
  });
}

export function filterProducts(products: readonly Product[], query: CatalogQuery): Product[] {
  return filterBase(products, query).filter((p) => {
    const price = minPrice(p);
    if (query.min !== undefined && price < query.min) return false;
    if (query.max !== undefined && price > query.max) return false;
    if (query.inStock && !isInStock(p)) return false;
    if (!hasOptionInStock(p, 'Size', query.size)) return false;
    if (!hasOptionInStock(p, 'Shade', query.shade)) return false;
    return true;
  });
}

const byNewest = (a: Product, b: Product) => b.createdAt.localeCompare(a.createdAt);

export function sortProducts(products: readonly Product[], sort: CatalogQuery['sort']): Product[] {
  const list = [...products];
  switch (sort) {
    case 'newest':
      return list.sort(byNewest);
    case 'price-asc':
      return list.sort((a, b) => minPrice(a) - minPrice(b) || byNewest(a, b));
    case 'price-desc':
      return list.sort((a, b) => minPrice(b) - minPrice(a) || byNewest(a, b));
    case 'rating':
      return list.sort(
        (a, b) =>
          b.rating.average - a.rating.average || b.rating.count - a.rating.count || byNewest(a, b),
      );
    case 'featured':
    default: {
      // featured → bestseller → in stock → newest
      const score = (p: Product) =>
        (p.featured ? 4 : 0) + (p.bestseller ? 2 : 0) + (isInStock(p) ? 1 : 0);
      return list.sort((a, b) => score(b) - score(a) || byNewest(a, b));
    }
  }
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: current,
    pageSize,
    pageCount,
  };
}

export function computeFacets(products: readonly Product[]): CatalogFacets {
  const prices = products.map(minPrice);
  const options = new Map<string, Map<string, FacetValue>>();

  for (const product of products) {
    for (const option of product.options) {
      const values = options.get(option.name) ?? new Map<string, FacetValue>();
      for (const { value, swatch } of option.values) {
        const entry = values.get(value) ?? { value, count: 0, swatch };
        entry.count += 1;
        values.set(value, entry);
      }
      options.set(option.name, values);
    }
  }

  return {
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    options: [...options].map(([name, values]) => ({ name, values: [...values.values()] })),
  };
}

export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
  const list = [...reviews];
  const newest = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case 'highest':
      return list.sort((a, b) => b.rating - a.rating || newest(a, b));
    case 'lowest':
      return list.sort((a, b) => a.rating - b.rating || newest(a, b));
    case 'helpful':
      return list.sort((a, b) => b.helpfulCount - a.helpfulCount || newest(a, b));
    case 'newest':
    default:
      return list.sort(newest);
  }
}
