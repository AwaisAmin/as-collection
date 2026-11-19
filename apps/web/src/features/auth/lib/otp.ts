import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_REQUESTS = 5;
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

/** Cryptographically random, zero-padded 6-digit code. */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** Codes are stored hashed (bound to the phone) — a leaked store doesn't reveal codes. */
export function hashOtp(phone: string, code: string, pepper: string): string {
  return createHash('sha256').update(`${phone}:${code}:${pepper}`).digest('hex');
}

/** Constant-time comparison (no timing side channel). */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Opaque session token (sent to the browser) + its hash (stored server-side). */
export function generateSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
