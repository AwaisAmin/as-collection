import { describe, expect, it } from 'vitest';

import { generateOtp, generateSessionToken, hashOtp, hashToken, safeEqualHex } from './otp';
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

describe('otp helpers', () => {
  it('generates 6-digit codes', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('binds hashes to phone and code', () => {
    const a = hashOtp('03001234567', '123456', 'pepper');
    expect(safeEqualHex(a, hashOtp('03001234567', '123456', 'pepper'))).toBe(true);
    expect(safeEqualHex(a, hashOtp('03001234568', '123456', 'pepper'))).toBe(false);
    expect(safeEqualHex(a, hashOtp('03001234567', '123457', 'pepper'))).toBe(false);
  });

  it('stores only token hashes', () => {
    const { token, hash } = generateSessionToken();
    expect(token).not.toBe(hash);
    expect(hashToken(token)).toBe(hash);
    expect(token.length).toBeGreaterThanOrEqual(43);
  });
});
