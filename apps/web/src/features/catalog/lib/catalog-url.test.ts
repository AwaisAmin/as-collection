import { describe, expect, it } from 'vitest';

import { parseCatalogQuery } from '../schemas';
import {
  catalogHref,
  clearFilters,
  countActiveFilters,
  toggleValue,
  toQueryString,
} from './catalog-url';

describe('toQueryString', () => {
  it('omits defaults', () => {
    expect(toQueryString(parseCatalogQuery({}))).toBe('');
  });

  it('serializes filters in a stable, readable order', () => {
    const q = parseCatalogQuery({
      page: '2',
      size: 'S,M',
      sort: 'price-asc',
      inStock: '1',
      min: '1000',
    });
    expect(toQueryString(q)).toBe('sort=price-asc&min=1000&size=S,M&inStock=1&page=2');
  });

  it('encodes values but keeps commas', () => {
    const q = parseCatalogQuery({ shade: 'Ruby Red,110 Porcelain', q: 'lawn & chiffon' });
    expect(toQueryString(q)).toBe('q=lawn%20%26%20chiffon&shade=Ruby%20Red,110%20Porcelain');
  });

  it('only includes category when asked (search page)', () => {
    const q = parseCatalogQuery({ category: 'makeup' });
    expect(toQueryString(q)).toBe('');
    expect(toQueryString(q, { includeCategory: true })).toBe('category=makeup');
  });
});

describe('catalogHref', () => {
  const base = parseCatalogQuery({ page: '3', size: 'M' });

  it('resets to page 1 when a filter changes', () => {
    expect(catalogHref('/shop', base, { size: ['M', 'L'] })).toBe('/shop?size=M,L');
  });

  it('keeps an explicit page', () => {
    expect(catalogHref('/shop', base, { page: 4 })).toBe('/shop?size=M&page=4');
  });

  it('returns the bare path when nothing is set', () => {
    expect(catalogHref('/shop/makeup', parseCatalogQuery({}))).toBe('/shop/makeup');
  });
});

describe('filter helpers', () => {
  it('toggles values', () => {
    expect(toggleValue(['S'], 'M')).toEqual(['S', 'M']);
    expect(toggleValue(['S', 'M'], 'S')).toEqual(['M']);
  });

  it('counts and clears active filters', () => {
    const q = parseCatalogQuery({
      min: '100',
      max: '900',
      size: 'S,M',
      inStock: '1',
      sort: 'newest',
      q: 'lawn',
    });
    expect(countActiveFilters(q)).toBe(4);
    const cleared = { ...q, ...clearFilters(q) };
    expect(countActiveFilters(cleared)).toBe(0);
    expect(cleared.sort).toBe('newest');
    expect(cleared.q).toBe('lawn');
  });
});
