import { describe, expect, it } from 'vitest';

import { safeNextPath } from '@/features/auth/safe-next';

import { isActive, navigationFor } from './navigation';
import { can, canAny } from './permissions';

describe('permissions', () => {
  it('grants by code, and "*" grants everything', () => {
    expect(can(['orders.read'], 'orders.read')).toBe(true);
    expect(can(['orders.read'], 'orders.write')).toBe(false);
    expect(can(['*'], 'staff.manage')).toBe(true);
    expect(canAny([], [])).toBe(true);
    expect(canAny(['inbox.read'], ['orders.read', 'inbox.read'])).toBe(true);
  });
});

describe('navigation', () => {
  it('always offers the dashboard and marks the current section', () => {
    expect(navigationFor([]).flatMap((g) => g.items.map((i) => i.href))).toContain('/');
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/orders/AS-1', '/')).toBe(false);
    expect(isActive('/orders/AS-1', '/orders')).toBe(true);
    expect(isActive('/ordersx', '/orders')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('only returns paths on this admin', () => {
    expect(safeNextPath('/orders?status=PENDING')).toBe('/orders?status=PENDING');
    const backslash = String.fromCharCode(92);
    for (const bad of [
      'https://evil.com',
      '//evil.com',
      `/${backslash}evil.com`,
      'javascript:alert(1)',
      42,
      null,
    ]) {
      expect(safeNextPath(bad)).toBe('/');
    }
    expect(safeNextPath('/login?next=/x')).toBe('/');
  });
});
