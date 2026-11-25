import { describe, expect, it } from 'vitest';

import { can, canAny, covers } from './permissions';

describe('permissions', () => {
  it('grants everything to "*"', () => {
    expect(can(['*'], 'orders.read')).toBe(true);
    expect(can(['orders.read'], 'orders.write')).toBe(false);
    expect(canAny(['inbox.read'], ['orders.read', 'inbox.read'])).toBe(true);
    expect(canAny([], [])).toBe(true);
  });

  it('only lets staff hand out access they hold themselves', () => {
    expect(covers(['*'], ['*'])).toBe(true);
    expect(covers(['orders.read', 'orders.write'], ['orders.read'])).toBe(true);
    expect(covers(['orders.read'], ['orders.read', 'orders.refund'])).toBe(false);
    // Full access can only come from someone who has it.
    expect(covers(['orders.read', 'staff.manage'], ['*'])).toBe(false);
    expect(covers(['orders.read'], [])).toBe(true);
  });
});
