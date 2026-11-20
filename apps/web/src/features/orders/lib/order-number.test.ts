import { describe, expect, it } from 'vitest';

import { ORDER_NUMBER_PATTERN } from './order-number';

describe('ORDER_NUMBER_PATTERN', () => {
  it('accepts API order numbers and rejects look-alikes', () => {
    expect(ORDER_NUMBER_PATTERN.test('AS-261120-7K3QX')).toBe(true);
    expect(ORDER_NUMBER_PATTERN.test('AS-261120-7K3QO')).toBe(false); // no O
    expect(ORDER_NUMBER_PATTERN.test('as-261120-7k3qx')).toBe(false);
    expect(ORDER_NUMBER_PATTERN.test('AS-26112-7K3QX')).toBe(false);
  });
});
