import { describe, expect, it } from 'vitest';

import { formatDate, formatPrice, pluralize } from './format';

describe('format utils', () => {
  it('formats PKR', () => {
    expect(formatPrice(899)).toBe('Rs 899');
    expect(formatPrice(14990)).toBe('Rs 14,990');
  });

  it('formats dates in Pakistan time', () => {
    expect(formatDate('2026-11-08T10:00:00.000Z')).toBe('8 Nov 2026');
    // 21:00 UTC on 31 Dec is already 1 Jan in Pakistan (UTC+5)
    expect(formatDate('2026-12-31T21:00:00.000Z')).toBe('1 Jan 2027');
  });

  it('pluralizes', () => {
    expect(pluralize(1, 'review')).toBe('1 review');
    expect(pluralize(0, 'review')).toBe('0 reviews');
  });
});
