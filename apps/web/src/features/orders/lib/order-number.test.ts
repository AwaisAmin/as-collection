import { describe, expect, it } from 'vitest';

import { generateAccessKey, generateOrderNumber, ORDER_NUMBER_PATTERN } from './order-number';

describe('order numbers', () => {
  it('uses the Pakistan date and an unambiguous suffix', () => {
    // 20:00 UTC on 18 Nov is already 19 Nov in Pakistan
    const n = generateOrderNumber(new Date('2026-11-18T20:00:00.000Z'));
    expect(n).toMatch(/^AS-261119-/);
    expect(n).toMatch(ORDER_NUMBER_PATTERN);
  });

  it('is effectively unique', () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateOrderNumber()));
    expect(set.size).toBeGreaterThan(1990);
  });

  it('creates 32-char hex access keys', () => {
    expect(generateAccessKey()).toMatch(/^[0-9a-f]{32}$/);
  });
});
