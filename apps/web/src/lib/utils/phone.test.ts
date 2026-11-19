import { describe, expect, it } from 'vitest';

import { formatPkMobile, normalizePkMobile } from './phone';

describe('normalizePkMobile', () => {
  it.each([
    ['0300-1234567', '03001234567'],
    ['0300 1234567', '03001234567'],
    ['+92 300 1234567', '03001234567'],
    ['923001234567', '03001234567'],
    ['00923289485741', '03289485741'],
    ['3289485741', '03289485741'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePkMobile(input)).toBe(expected);
  });

  it.each(['', '12345', '0423-1234567', '0300-123456', '03001234567890', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normalizePkMobile(input)).toBeNull();
    },
  );

  it('formats for display', () => {
    expect(formatPkMobile('03289485741')).toBe('0328-9485741');
  });
});
