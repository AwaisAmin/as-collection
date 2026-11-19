import { covers, hasPermission } from '../permissions.js';
import { CHALLENGE_TTL_MS, issueChallenge, readChallenge } from './login-challenge.js';
import { SecretBox } from './secret-box.js';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpStep,
  verifyTotp,
} from './totp.js';

// RFC 6238 appendix B: SHA-1 seed "12345678901234567890" (8-digit values; we use the last 6).
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('TOTP', () => {
  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
  ])('matches the RFC 6238 vector at t=%i', (seconds, code) => {
    expect(hotp(RFC_SECRET, Math.floor(seconds / 30))).toBe(code);
  });

  it('round-trips base32', () => {
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode('gezd gnbv-gy3tqojqgezdgnbvgy3tqojq').equals(RFC_SECRET)).toBe(true);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepts ±1 step and refuses replays', () => {
    const secret = base32Encode(RFC_SECRET);
    const now = new Date(1_234_567_890_000);
    const step = totpStep(now);
    expect(verifyTotp(secret, hotp(RFC_SECRET, step), now, null)).toBe(step);
    expect(verifyTotp(secret, hotp(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(secret, hotp(RFC_SECRET, step - 2), now, null)).toBeNull();
    expect(verifyTotp(secret, hotp(RFC_SECRET, step), now, step)).toBeNull(); // replay
    expect(verifyTotp(secret, '12345', now, null)).toBeNull();
  });

  it('builds an otpauth URI', () => {
    expect(otpauthUri('ABC', 'owner@shop.pk', 'AS Collection')).toBe(
      'otpauth://totp/AS%20Collection:owner%40shop.pk?secret=ABC&issuer=AS+Collection&algorithm=SHA1&digits=6&period=30',
    );
  });
});

describe('SecretBox', () => {
  const box = new SecretBox(Buffer.alloc(32, 1).toString('base64'));

  it('seals with a fresh IV and opens only for the same row', () => {
    const a = box.seal('JBSWY3DPEHPK3PXP', 'staff:1');
    expect(a).not.toBe(box.seal('JBSWY3DPEHPK3PXP', 'staff:1'));
    expect(box.open(a, 'staff:1')).toBe('JBSWY3DPEHPK3PXP');
    expect(() => box.open(a, 'staff:2')).toThrow();
    expect(() =>
      new SecretBox(Buffer.alloc(32, 2).toString('base64')).open(a, 'staff:1'),
    ).toThrow();
    const [v, iv, tag, ct] = a.split('.');
    expect(() => box.open([v, iv, tag, `A${ct ?? ''}`].join('.'), 'staff:1')).toThrow();
  });
});

describe('login challenge', () => {
  const secret = 's'.repeat(40);
  const now = new Date('2026-11-20T10:00:00Z');

  it('verifies purpose, expiry and signature', () => {
    const token = issueChallenge(secret, 'staff-1', 'totp', 42, now);
    expect(readChallenge(secret, token, ['totp'], now)).toEqual({
      staffId: 'staff-1',
      purpose: 'totp',
      passwordVersion: 42,
    });
    expect(readChallenge(secret, token, ['enrol'], now)).toBeNull();
    expect(
      readChallenge(secret, token, ['totp'], new Date(now.getTime() + CHALLENGE_TTL_MS)),
    ).toBeNull();
    expect(readChallenge('t'.repeat(40), token, ['totp'], now)).toBeNull();

    const [payload, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()),
        sid: 'x',
      }),
    ).toString('base64url');
    expect(readChallenge(secret, `${forged}.${sig ?? ''}`, ['totp'], now)).toBeNull();
  });
});

describe('permissions', () => {
  it('treats "*" as everything and blocks escalation', () => {
    expect(hasPermission(new Set(['*']), 'staff.manage')).toBe(true);
    expect(hasPermission(new Set(['orders.read']), 'orders.write')).toBe(false);
    expect(covers(new Set(['orders.read', 'orders.write']), ['orders.read'])).toBe(true);
    expect(covers(new Set(['orders.read']), ['orders.read', 'staff.manage'])).toBe(false);
    expect(covers(new Set(['staff.manage']), ['*'])).toBe(false);
    expect(covers(new Set(['*']), ['*'])).toBe(true);
  });
});
