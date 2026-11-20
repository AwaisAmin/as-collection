import { hmacHex, randomDigits, randomToken, safeEqualHex, sha256Hex, uuidv7 } from './crypto.js';

describe('crypto helpers', () => {
  it('compares digests in constant time and rejects mismatched or empty input', () => {
    const digest = sha256Hex('a');
    expect(safeEqualHex(digest, sha256Hex('a'))).toBe(true);
    expect(safeEqualHex(digest, sha256Hex('b'))).toBe(false);
    expect(safeEqualHex(digest, digest.slice(0, 10))).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });

  it('keys HMACs by secret', () => {
    expect(hmacHex('s1', 'x')).not.toBe(hmacHex('s2', 'x'));
    expect(hmacHex('s1', 'x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates fixed-length codes and tokens', () => {
    for (let i = 0; i < 50; i++) expect(randomDigits(6)).toMatch(/^\d{6}$/);
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe('uuidv7', () => {
  it('is a valid v7 UUID whose order follows time', () => {
    const early = uuidv7(1_700_000_000_000);
    const late = uuidv7(1_700_000_000_001);
    expect(early).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(early < late).toBe(true);
    expect(early.slice(0, 13)).toBe('018bcfe5-6800');
  });
});
