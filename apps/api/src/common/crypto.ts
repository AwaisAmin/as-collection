import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

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

/** Keyed hash of a client IP for abuse limits — the raw address is never stored. */
export const ipHashOf = (secret: string, ip: string | null) =>
  ip ? hmacHex(secret, `ip:${ip}`) : null;

/**
 * RFC 9562 UUIDv7 (millisecond timestamp + random), like the database's `uuid(7)` defaults:
 * for ids needed before the row exists (e.g. storage keys), keeping id order = time order.
 */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now, 0, 6);
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f); // version 7
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
