import { describe, expect, it } from 'vitest';

import type { CartItem } from '../types';
import { applySnapshots } from './sync-cart';

const item = (overrides: Partial<CartItem>): CartItem => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'p1',
  name: 'Kurta',
  sku: 'SKU',
  options: {},
  image: { src: '/x.jpg', alt: '' },
  price: 1000,
  quantity: 2,
  maxQuantity: 10,
  ...overrides,
});

describe('applySnapshots', () => {
  it('leaves unchanged lines alone and reports nothing', () => {
    const { items, changes } = applySnapshots(
      [item({})],
      [{ variantId: 'v1', price: 1000, stock: 8 }],
    );
    expect(changes).toEqual([]);
    expect(items[0]).toMatchObject({ price: 1000, quantity: 2, maxQuantity: 8 });
  });

  it('updates prices and reports the change', () => {
    const { items, changes } = applySnapshots(
      [item({})],
      [{ variantId: 'v1', price: 900, stock: 8 }],
    );
    expect(items[0]?.price).toBe(900);
    expect(changes).toEqual([{ kind: 'price', name: 'Kurta', from: 1000, to: 900 }]);
  });

  it('caps quantity to remaining stock', () => {
    const { items, changes } = applySnapshots(
      [item({ quantity: 5 })],
      [{ variantId: 'v1', price: 1000, stock: 2 }],
    );
    expect(items[0]?.quantity).toBe(2);
    expect(changes).toEqual([{ kind: 'quantity', name: 'Kurta', to: 2 }]);
  });

  it('flags sold-out and missing variants as unavailable', () => {
    const { items, changes } = applySnapshots(
      [item({}), item({ variantId: 'gone', name: 'Old' })],
      [{ variantId: 'v1', price: 1000, stock: 0 }],
    );
    expect(items.every((i) => i.unavailable)).toBe(true);
    expect(changes.map((c) => c.kind)).toEqual(['unavailable', 'unavailable']);
  });
});
