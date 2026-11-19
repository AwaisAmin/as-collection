import { describe, expect, it } from 'vitest';

import { mockProducts, mockReviews } from '../data';
import type { Product, Review } from '../types';
import {
  discountPercent,
  findVariant,
  isNew,
  summarizeReviews,
  toSummary,
} from './product-helpers';

const bySlug = (slug: string) => {
  const p = mockProducts.find((x) => x.slug === slug);
  if (!p) throw new Error(`missing ${slug}`);
  return p;
};

const NOW = new Date('2026-11-19T00:00:00.000Z');

describe('toSummary', () => {
  it('marks discounted products as on sale with the compare-at price', () => {
    const s = toSummary(bySlug('noor-e-zar-embroidered-lawn-3-piece'), NOW);
    expect(s.price).toBe(6490);
    expect(s.compareAtPrice).toBe(7990);
    expect(s.badges).toContain('sale');
  });

  it('only shows sold-out for products without stock', () => {
    const s = toSummary(bySlug('gulnar-jacquard-unstitched-3-piece'), NOW);
    expect(s.inStock).toBe(false);
    expect(s.badges).toEqual(['sold-out']);
    expect(s.quickAddVariantId).toBeUndefined();
  });

  it('offers quick add only for single-variant in-stock products', () => {
    expect(toSummary(bySlug('pro-kabuki-powder-brush'), NOW).quickAddVariantId).toBeDefined();
    expect(
      toSummary(bySlug('maroon-ruby-embroidered-kurta'), NOW).quickAddVariantId,
    ).toBeUndefined();
  });
});

describe('findVariant', () => {
  it('finds the variant matching the selected options', () => {
    const kurta: Product = bySlug('maroon-ruby-embroidered-kurta');
    expect(findVariant(kurta, { Size: 'M' })?.sku).toBe('STCH-001-M');
    expect(findVariant(kurta, { Size: 'XXL' })).toBeUndefined();
  });
});

describe('pricing helpers', () => {
  it('computes discount percentage', () => {
    expect(discountPercent(7490, 8990)).toBe(17);
    expect(discountPercent(5000)).toBeUndefined();
    expect(discountPercent(5000, 4000)).toBeUndefined();
  });

  it('flags products created in the last 30 days as new', () => {
    expect(isNew('2026-11-10T00:00:00.000Z', NOW)).toBe(true);
    expect(isNew('2026-08-01T00:00:00.000Z', NOW)).toBe(false);
  });
});

describe('summarizeReviews', () => {
  it('builds average and star distribution', () => {
    const reviews = [5, 5, 4, 1].map((rating, i) => ({ id: String(i), rating })) as Review[];
    const s = summarizeReviews(reviews);
    expect(s.count).toBe(4);
    expect(s.average).toBe(3.8);
    expect(s.distribution).toEqual([1, 0, 0, 1, 2]);
  });

  it('keeps product ratings consistent with mock reviews', () => {
    for (const p of mockProducts) {
      const count = mockReviews.filter((r) => r.productId === p.id).length;
      expect(p.rating.count).toBe(count);
    }
  });
});
