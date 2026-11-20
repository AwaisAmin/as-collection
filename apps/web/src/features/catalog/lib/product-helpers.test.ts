import { describe, expect, it } from 'vitest';

import { compareAtFor, discountPercent, findVariant, minPrice } from './product-helpers';
import { kurta, lipstick } from './test-fixtures';

describe('product helpers', () => {
  it('finds the variant matching the selected options', () => {
    expect(findVariant(kurta, { Size: 'M' })?.sku).toBe('STCH-001-M');
    expect(findVariant(kurta, { Size: 'XXL' })).toBeUndefined();
  });

  it('prices from the cheapest variant, with its real discount', () => {
    expect(minPrice(kurta)).toBe(7490);
    expect(compareAtFor(kurta)).toBe(8990);
    expect(compareAtFor(lipstick)).toBeUndefined();
  });

  it('computes the discount percentage', () => {
    expect(discountPercent(7490, 8990)).toBe(17);
    expect(discountPercent(5000)).toBeUndefined();
    expect(discountPercent(5000, 4000)).toBeUndefined();
  });
});
