import { generateOrderNumber, normalizeOrderNumber, ORDER_NUMBER_PATTERN } from './order-number.js';

describe('order numbers', () => {
  it('uses the Pakistan date', () => {
    // 20:00 UTC on 18 Nov is already 19 Nov in Pakistan.
    expect(generateOrderNumber(new Date('2026-11-18T20:00:00Z'))).toMatch(/^AS-261119-/);
  });

  it('matches the pattern and is effectively unique', () => {
    const numbers = Array.from({ length: 2000 }, () => generateOrderNumber());
    expect(numbers.every((n) => ORDER_NUMBER_PATTERN.test(n))).toBe(true);
    expect(new Set(numbers).size).toBeGreaterThan(1990);
  });

  it('normalizes what customers type', () => {
    expect(normalizeOrderNumber(' as-261119-7kq4m ')).toBe('AS-261119-7KQ4M');
    expect(normalizeOrderNumber('AS 261119 7KQ4M')).toBe('AS-261119-7KQ4M');
    expect(normalizeOrderNumber('AS2611197KQ4M')).toBe('AS-261119-7KQ4M');
    expect(normalizeOrderNumber('AS-261119-7KQ40')).toBeNull(); // 0 is not in the alphabet
    expect(normalizeOrderNumber('hello')).toBeNull();
  });
});
