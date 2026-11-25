import {
  buildQuote,
  type DiscountRule,
  evaluateDiscount,
  normalizeLines,
  type PricedVariant,
  sellableUnits,
} from './pricing.js';

const now = new Date('2026-11-19T12:00:00Z');
const shipping = { flatFeeMinor: 25_000, freeShippingThresholdMinor: 250_000 };

const variant = (id: string, overrides: Partial<PricedVariant> = {}): PricedVariant => ({
  id,
  sku: `SKU-${id}`,
  title: 'M',
  productId: `p-${id}`,
  productSlug: `product-${id}`,
  productName: `Product ${id}`,
  priceMinor: 100_000,
  compareAtPriceMinor: null,
  sellable: true,
  image: null,
  inventory: { onHand: 5, reserved: 0, tracked: true, backorder: false },
  ...overrides,
});

const rule = (overrides: Partial<DiscountRule> = {}): DiscountRule => ({
  id: 'd1',
  code: 'EID15',
  type: 'PERCENTAGE',
  value: 1500,
  minSubtotalMinor: null,
  maxDiscountMinor: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usageCount: 0,
  perCustomerLimit: null,
  isActive: true,
  ...overrides,
});

const map = (...variants: PricedVariant[]) => new Map(variants.map((v) => [v.id, v]));

describe('normalizeLines', () => {
  it('merges duplicates and caps each line at 10', () => {
    expect(
      normalizeLines([
        { variantId: 'a', quantity: 6 },
        { variantId: 'b', quantity: 1 },
        { variantId: 'a', quantity: 6 },
      ]),
    ).toEqual([
      { variantId: 'a', quantity: 10 },
      { variantId: 'b', quantity: 1 },
    ]);
  });
});

describe('sellableUnits', () => {
  it('subtracts reservations and treats untracked/backorder stock as unlimited', () => {
    expect(sellableUnits({ onHand: 5, reserved: 2, tracked: true, backorder: false })).toBe(3);
    expect(sellableUnits({ onHand: 1, reserved: 3, tracked: true, backorder: false })).toBe(0);
    expect(sellableUnits({ onHand: 0, reserved: 0, tracked: false, backorder: false })).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(sellableUnits(null)).toBe(0);
  });
});

describe('buildQuote', () => {
  it('prices lines from the server, charging shipping below the threshold', () => {
    const quote = buildQuote({
      lines: [{ variantId: 'a', quantity: 2 }],
      variants: map(variant('a', { compareAtPriceMinor: 120_000 })),
      shipping,
      now,
    });
    expect(quote).toMatchObject({
      itemCount: 2,
      subtotalMinor: 200_000,
      savingsMinor: 40_000,
      shippingMinor: 25_000,
      totalMinor: 225_000,
      freeShippingRemainingMinor: 50_000,
      purchasable: true,
    });
  });

  it('ships free at the threshold', () => {
    const quote = buildQuote({
      lines: [{ variantId: 'a', quantity: 3 }],
      variants: map(variant('a')),
      shipping,
      now,
    });
    expect(quote).toMatchObject({ subtotalMinor: 300_000, shippingMinor: 0, totalMinor: 300_000 });
  });

  it('flags unavailable and short-stocked lines and excludes unknown ones from totals', () => {
    const quote = buildQuote({
      lines: [
        { variantId: 'a', quantity: 4 },
        { variantId: 'gone', quantity: 1 },
        { variantId: 'hidden', quantity: 1 },
      ],
      variants: map(
        variant('a', { inventory: { onHand: 5, reserved: 2, tracked: true, backorder: false } }),
        variant('hidden', { sellable: false }),
      ),
      shipping,
      now,
    });
    expect(quote.lines.map((l) => [l.variantId, l.problem, l.availableQuantity])).toEqual([
      ['a', 'INSUFFICIENT_STOCK', 3],
      ['gone', 'UNAVAILABLE', 0],
      ['hidden', 'UNAVAILABLE', 0],
    ]);
    expect(quote.subtotalMinor).toBe(400_000);
    expect(quote.purchasable).toBe(false);
  });

  it('never reveals stock beyond the visible cap', () => {
    const quote = buildQuote({
      lines: [{ variantId: 'a', quantity: 1 }],
      variants: map(
        variant('a', { inventory: { onHand: 500, reserved: 0, tracked: true, backorder: false } }),
      ),
      shipping,
      now,
    });
    expect(quote.lines[0]?.availableQuantity).toBe(10);
  });

  it('applies coupons before shipping, free shipping coupons included', () => {
    const pct = buildQuote({
      lines: [{ variantId: 'a', quantity: 1 }],
      variants: map(variant('a')),
      shipping,
      discount: { code: 'eid15', rule: rule() },
      now,
    });
    expect(pct).toMatchObject({
      discountMinor: 15_000,
      shippingMinor: 25_000,
      totalMinor: 110_000,
    });

    const free = buildQuote({
      lines: [{ variantId: 'a', quantity: 1 }],
      variants: map(variant('a')),
      shipping,
      discount: { code: 'SHIPFREE', rule: rule({ type: 'FREE_SHIPPING', value: 0 }) },
      now,
    });
    expect(free).toMatchObject({ discountMinor: 0, shippingMinor: 0, totalMinor: 100_000 });
  });
});

describe('evaluateDiscount', () => {
  it('caps percentage and fixed discounts', () => {
    expect(evaluateDiscount(rule({ maxDiscountMinor: 10_000 }), 'x', 200_000, now)).toMatchObject({
      applied: true,
      discountMinor: 10_000,
    });
    expect(
      evaluateDiscount(rule({ type: 'FIXED_AMOUNT', value: 500_000 }), 'x', 200_000, now),
    ).toMatchObject({ applied: true, discountMinor: 200_000 });
  });

  it('rounds percentage discounts down to whole rupees', () => {
    // 15 % of Rs 1,290 = Rs 193.50 → Rs 193 (totals are confirmed in rupees).
    expect(evaluateDiscount(rule(), 'x', 129_000, now)).toMatchObject({
      applied: true,
      discountMinor: 19_300,
    });
  });

  it.each([
    [null, 'NOT_FOUND'],
    [rule({ isActive: false }), 'INACTIVE'],
    [rule({ startsAt: new Date('2026-12-01') }), 'NOT_STARTED'],
    [rule({ endsAt: new Date('2026-11-01') }), 'EXPIRED'],
    [rule({ usageLimit: 10, usageCount: 10 }), 'USAGE_LIMIT'],
    [rule({ minSubtotalMinor: 500_000 }), 'MIN_SUBTOTAL'],
  ] as const)('rejects with a reason (%#)', (discountRule, reason) => {
    expect(evaluateDiscount(discountRule, 'CODE', 100_000, now)).toMatchObject({
      applied: false,
      reason,
    });
  });
});
