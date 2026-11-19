import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: order numbers are read out over the phone. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export const ORDER_NUMBER_PATTERN = /^AS-\d{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;

/** `AS-261119-7KQ4M`: Pakistan-time date + 5 random characters (~28.6M per day). */
export function generateOrderNumber(now: Date = new Date()): string {
  const d = new Date(now.getTime() + PKT_OFFSET_MS);
  const date = [d.getUTCFullYear() % 100, d.getUTCMonth() + 1, d.getUTCDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  const suffix = Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `AS-${date}-${suffix}`;
}

/** Accepts what customers type: lowercase, spaces, missing dashes (`as 261119 7kq4m`). */
export function normalizeOrderNumber(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  const match = /^AS(\d{6})([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5})$/.exec(compact);
  return match ? `AS-${match[1] ?? ''}-${match[2] ?? ''}` : null;
}
