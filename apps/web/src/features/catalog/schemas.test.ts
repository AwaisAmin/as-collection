import { describe, expect, it } from 'vitest';

import { formatPrice } from '@/lib/utils/format';

import { parseCatalogQuery } from './schemas';

describe('parseCatalogQuery', () => {
  it('applies defaults', () => {
    expect(parseCatalogQuery({})).toEqual({
      sort: 'featured',
      size: [],
      shade: [],
      occasion: [],
      inStock: false,
      sale: false,
      page: 1,
    });
  });

  it('parses comma lists and repeated params', () => {
    expect(parseCatalogQuery({ size: 'S,M' }).size).toEqual(['S', 'M']);
    expect(parseCatalogQuery({ size: ['S', 'L'] }).size).toEqual(['S', 'L']);
  });

  it('falls back instead of throwing on bad (user-edited) URLs', () => {
    const q = parseCatalogQuery({ sort: 'cheapest', page: '-3', min: 'abc', category: 'Shoes!' });
    expect(q.sort).toBe('featured');
    expect(q.page).toBe(1);
    expect(q.min).toBeUndefined();
    expect(q.category).toBeUndefined();
  });

  it('accepts any category slug the admin could create', () => {
    expect(parseCatalogQuery({ category: 'bridal-wear' }).category).toBe('bridal-wear');
  });

  it('lets route params override search params', () => {
    expect(parseCatalogQuery({ category: 'makeup' }, { category: 'stitched' }).category).toBe(
      'stitched',
    );
  });
});

describe('formatPrice', () => {
  it('formats whole PKR amounts', () => {
    expect(formatPrice(3490)).toBe('Rs 3,490');
    expect(formatPrice(12500)).toBe('Rs 12,500');
  });
});
