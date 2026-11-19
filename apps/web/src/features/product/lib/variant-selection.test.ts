import { describe, expect, it } from 'vitest';

import { mockProducts } from '@/features/catalog/data';

import {
  initialSelection,
  isValueAvailable,
  missingOptions,
  stockStatus,
} from './variant-selection';

const bySlug = (slug: string) => {
  const p = mockProducts.find((x) => x.slug === slug);
  if (!p) throw new Error(slug);
  return p;
};

describe('variant selection', () => {
  const kurta = bySlug('maroon-ruby-embroidered-kurta'); // XL stock 0
  const lipstick = bySlug('velvet-matte-lipstick'); // Nude Petal stock 0

  it('requires sizes to be chosen explicitly', () => {
    expect(initialSelection(kurta)).toEqual({});
    expect(missingOptions(kurta, {})).toEqual(['Size']);
  });

  it('preselects the first in-stock shade', () => {
    expect(initialSelection(lipstick)).toEqual({ Shade: 'Ruby Red' });
    expect(missingOptions(lipstick, { Shade: 'Ruby Red' })).toEqual([]);
  });

  it('marks sold-out values unavailable', () => {
    expect(isValueAvailable(kurta, {}, 'Size', 'M')).toBe(true);
    expect(isValueAvailable(kurta, {}, 'Size', 'XL')).toBe(false);
    expect(isValueAvailable(lipstick, {}, 'Shade', 'Nude Petal')).toBe(false);
  });

  it('describes stock levels', () => {
    expect(stockStatus(0).level).toBe('out');
    expect(stockStatus(2)).toEqual({ level: 'low', label: 'Only 2 left — order soon' });
    expect(stockStatus(20).level).toBe('in');
  });
});
