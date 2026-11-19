import { describe, expect, it } from 'vitest';

import type { CartItem } from '../types';
import { computeCartTotals } from './cart-totals';

const rules = { freeShippingThreshold: 2500, shippingFee: 250 };

const item = (overrides: Partial<CartItem>): CartItem => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'p1',
  name: 'Item',
  sku: 'SKU',
  options: {},
  image: { src: '/x.jpg', alt: '' },
  price: 1000,
  quantity: 1,
  maxQuantity: 10,
  ...overrides,
});

describe('computeCartTotals', () => {
  it('is all zeros for an empty cart (no delivery fee)', () => {
    const t = computeCartTotals([], rules);
    expect(t).toMatchObject({ itemCount: 0, subtotal: 0, shipping: 0, total: 0 });
    expect(t.qualifiesForFreeShipping).toBe(false);
  });

  it('charges the delivery fee below the threshold and reports the gap', () => {
    const t = computeCartTotals([item({ price: 1290, quantity: 1 })], rules);
    expect(t.shipping).toBe(250);
    expect(t.total).toBe(1540);
    expect(t.freeShippingRemaining).toBe(1210);
    expect(t.freeShippingProgress).toBeCloseTo(0.516);
  });

  it('gives free delivery at exactly the threshold', () => {
    const t = computeCartTotals([item({ price: 1250, quantity: 2 })], rules);
    expect(t.subtotal).toBe(2500);
    expect(t.shipping).toBe(0);
    expect(t.qualifiesForFreeShipping).toBe(true);
    expect(t.freeShippingProgress).toBe(1);
  });

  it('sums savings from compare-at prices', () => {
    const t = computeCartTotals(
      [
        item({ price: 9990, compareAtPrice: 12500, quantity: 2 }),
        item({ variantId: 'v2', price: 899 }),
      ],
      rules,
    );
    expect(t.subtotal).toBe(9990 * 2 + 899);
    expect(t.savings).toBe((12500 - 9990) * 2);
    expect(t.itemCount).toBe(3);
  });

  it('excludes unavailable lines from totals but counts them', () => {
    const t = computeCartTotals(
      [item({ price: 3000 }), item({ variantId: 'v2', price: 5000, unavailable: true })],
      rules,
    );
    expect(t.subtotal).toBe(3000);
    expect(t.unavailableCount).toBe(1);
  });
});
