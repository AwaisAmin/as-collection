import { describe, expect, it } from 'vitest';

import { mockProducts } from '../data';
import { parseCatalogQuery } from '../schemas';
import { minPrice } from './product-helpers';
import {
  computeFacets,
  filterProducts,
  matchesSearch,
  paginate,
  sortProducts,
} from './query-products';

const query = (params: Record<string, string> = {}) => parseCatalogQuery(params);

describe('filterProducts', () => {
  it('filters by category', () => {
    const result = filterProducts(mockProducts, query({ category: 'makeup' }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.category === 'makeup')).toBe(true);
  });

  it('requires every search word to match', () => {
    const result = filterProducts(mockProducts, query({ q: 'black chiffon' }));
    expect(result.map((p) => p.slug)).toContain('siyah-chiffon-gold-zari-suit');
    expect(result.every((p) => matchesSearch(p, 'black chiffon'))).toBe(true);
    expect(filterProducts(mockProducts, query({ q: 'zzz-no-match' }))).toHaveLength(0);
  });

  it('applies the price range to the lowest variant price', () => {
    const result = filterProducts(mockProducts, query({ min: '2000', max: '6000' }));
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(minPrice(p)).toBeGreaterThanOrEqual(2000);
      expect(minPrice(p)).toBeLessThanOrEqual(6000);
    }
  });

  it('only matches sizes that are actually in stock', () => {
    // Maroon Ruby Kurta has XL stock 0
    const xl = filterProducts(mockProducts, query({ size: 'XL' })).map((p) => p.slug);
    expect(xl).not.toContain('maroon-ruby-embroidered-kurta');
    const m = filterProducts(mockProducts, query({ size: 'M' })).map((p) => p.slug);
    expect(m).toContain('maroon-ruby-embroidered-kurta');
  });

  it('hides sold-out products when inStock is set', () => {
    const all = filterProducts(mockProducts, query({ category: 'unstitched' }));
    const inStock = filterProducts(mockProducts, query({ category: 'unstitched', inStock: '1' }));
    expect(all.map((p) => p.slug)).toContain('gulnar-jacquard-unstitched-3-piece');
    expect(inStock.map((p) => p.slug)).not.toContain('gulnar-jacquard-unstitched-3-piece');
  });
});

describe('sortProducts', () => {
  it('sorts by price ascending and descending', () => {
    const asc = sortProducts(mockProducts, 'price-asc').map(minPrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortProducts(mockProducts, 'price-desc').map(minPrice);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('sorts newest first', () => {
    const dates = sortProducts(mockProducts, 'newest').map((p) => p.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('does not mutate the input', () => {
    const before = mockProducts.map((p) => p.id);
    sortProducts(mockProducts, 'price-asc');
    expect(mockProducts.map((p) => p.id)).toEqual(before);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it('returns the requested page', () => {
    const page = paginate(items, 2, 10);
    expect(page.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(page.pageCount).toBe(3);
    expect(page.total).toBe(25);
  });

  it('clamps out-of-range pages', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate([], 5, 10)).toMatchObject({ page: 1, pageCount: 1, items: [] });
  });
});

describe('computeFacets', () => {
  it('collects size options in definition order with counts', () => {
    const facets = computeFacets(filterProducts(mockProducts, query({ category: 'stitched' })));
    const size = facets.options.find((o) => o.name === 'Size');
    expect(size?.values.map((v) => v.value)).toEqual(['XS', 'S', 'M', 'L', 'XL']);
    expect(facets.priceRange.min).toBeLessThanOrEqual(facets.priceRange.max);
  });
});
