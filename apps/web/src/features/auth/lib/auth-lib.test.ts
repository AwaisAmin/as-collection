import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each(['/account', '/account/orders?page=2', '/products/x#reviews'])('allows %s', (p) => {
    expect(safeRedirectPath(p)).toBe(p);
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'account',
    '/login?next=/account',
    '',
    undefined,
    ['/account'],
  ])('rejects %s', (p) => {
    expect(safeRedirectPath(p)).toBe('/account');
  });
});
