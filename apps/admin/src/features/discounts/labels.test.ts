import { describe, expect, it } from 'vitest';

import {
  basisPointsToPercent,
  discountSummary,
  percentToBasisPoints,
  randomCode,
  usageText,
} from './labels';

describe('discount helpers', () => {
  it('converts percentages and basis points', () => {
    expect(percentToBasisPoints('15')).toBe(1500);
    expect(percentToBasisPoints(' 12.5 % ')).toBe(1250);
    expect(percentToBasisPoints('')).toBeNull();
    expect(percentToBasisPoints('abc')).toBeNaN();
    expect(basisPointsToPercent(1250)).toBe('12.5');
  });

  it('describes a code in plain words', () => {
    expect(
      discountSummary({
        type: 'PERCENTAGE',
        value: 1500,
        maxDiscountMinor: 100_000,
        minSubtotalMinor: 300_000,
      }),
    ).toBe('15% off, up to Rs 1,000 · orders over Rs 3,000');
    expect(
      discountSummary({
        type: 'FIXED_AMOUNT',
        value: 50_000,
        maxDiscountMinor: null,
        minSubtotalMinor: null,
      }),
    ).toBe('Rs 500 off');
    expect(
      discountSummary({
        type: 'FREE_SHIPPING',
        value: 0,
        maxDiscountMinor: null,
        minSubtotalMinor: null,
      }),
    ).toBe('Free delivery');
    expect(usageText({ usageCount: 3, usageLimit: 100 })).toBe('3 of 100 used');
    expect(usageText({ usageCount: 3, usageLimit: null })).toBe('3 used');
  });

  it('makes readable codes', () => {
    expect(randomCode(() => 0)).toBe('AS-AAAAAA');
    expect(randomCode()).toMatch(/^AS-[A-HJKMNP-Z2-9]{6}$/);
  });
});
