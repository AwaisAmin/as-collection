/** No 0/O, 1/I/L — order numbers get read out over the phone. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function randomChars(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** "AS-261119-7KQ4M" — date (Pakistan time) + 5 random chars (~28M per day). */
export function generateOrderNumber(now: Date = new Date()): string {
  const d = new Date(now.getTime() + PKT_OFFSET_MS);
  const yymmdd = [d.getUTCFullYear() % 100, d.getUTCMonth() + 1, d.getUTCDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  return `AS-${yymmdd}-${randomChars(5)}`;
}

export const ORDER_NUMBER_PATTERN = /^AS-\d{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;

/** Unguessable key for the customer's order link. */
export function generateAccessKey(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
