import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * TOTP (RFC 6238 over RFC 4226 HOTP): SHA-1, 6 digits, 30-second steps — the parameters every
 * authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) supports.
 */

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Accept the previous and next step too (phone clocks drift; codes are typed slowly). */
export const TOTP_DRIFT_STEPS = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32.charAt((value << (5 - bits)) & 31);
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New 160-bit secret, base32 (what the authenticator app stores). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const totpStep = (now: Date) => Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);

/** HOTP value for a counter (RFC 4226 dynamic truncation). */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Checks a code against the current step ± drift. Returns the matched step, or `null`. Steps at
 * or before `lastUsedStep` are refused, so an observed code can never be replayed.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  now: Date,
  lastUsedStep: number | null,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(now);
  let matched: number | null = null;
  // Check every candidate (no early exit) so timing does not reveal which step matched.
  for (let step = current - TOTP_DRIFT_STEPS; step <= current + TOTP_DRIFT_STEPS; step += 1) {
    const ok = timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code));
    if (ok && matched === null && (lastUsedStep === null || step > lastUsedStep)) matched = step;
  }
  return matched;
}

/** `otpauth://` URI the admin panel renders as a QR code. */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
