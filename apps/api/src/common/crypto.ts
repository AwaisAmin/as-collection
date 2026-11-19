import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/** Keyed hash: unlike a plain SHA-256, it cannot be brute-forced without the server secret. */
export const hmacHex = (secret: string, value: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

/** Constant-time comparison of two hex digests (no timing side channel). */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Cryptographically random numeric code, zero-padded (`004219`). */
export const randomDigits = (length: number) =>
  String(randomInt(0, 10 ** length)).padStart(length, '0');

/** 256-bit random token, base64url (43 chars). */
export const randomToken = () => randomBytes(32).toString('base64url');
