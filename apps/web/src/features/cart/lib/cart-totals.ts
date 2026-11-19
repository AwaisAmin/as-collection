import { siteConfig } from '@/config/site';

import type { CartItem } from '../types';

export interface ShippingRules {
  freeShippingThreshold: number;
  shippingFee: number;
}

export interface CartTotals {
  /** Units across purchasable lines. */
  itemCount: number;
  subtotal: number;
  /** Discount vs. compare-at prices. */
  savings: number;
  shipping: number;
  total: number;
  qualifiesForFreeShipping: boolean;
  /** Amount still needed for free delivery (0 when qualified). */
  freeShippingRemaining: number;
  /** 0–1 progress toward free delivery. */
  freeShippingProgress: number;
  /** Lines that can't be bought anymore (block checkout until removed). */
  unavailableCount: number;
}

const defaultRules: ShippingRules = {
  freeShippingThreshold: siteConfig.freeShippingThreshold,
  shippingFee: siteConfig.shippingFee,
};

/** Single source of truth for cart math (drawer, cart page, checkout). Whole PKR only. */
export function computeCartTotals(
  items: readonly CartItem[],
  rules: ShippingRules = defaultRules,
): CartTotals {
  const lines = items.filter((i) => !i.unavailable);
  const itemCount = lines.reduce((n, i) => n + i.quantity, 0);
  const subtotal = lines.reduce((n, i) => n + i.price * i.quantity, 0);
  const compareSubtotal = lines.reduce(
    (n, i) => n + Math.max(i.compareAtPrice ?? i.price, i.price) * i.quantity,
    0,
  );

  const qualifies = subtotal >= rules.freeShippingThreshold;
  const shipping = itemCount === 0 || qualifies ? 0 : rules.shippingFee;

  return {
    itemCount,
    subtotal,
    savings: compareSubtotal - subtotal,
    shipping,
    total: subtotal + shipping,
    qualifiesForFreeShipping: itemCount > 0 && qualifies,
    freeShippingRemaining: qualifies ? 0 : rules.freeShippingThreshold - subtotal,
    freeShippingProgress: Math.min(1, subtotal / rules.freeShippingThreshold),
    unavailableCount: items.length - lines.length,
  };
}
