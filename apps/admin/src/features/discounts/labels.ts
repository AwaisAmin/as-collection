import type { AdminDiscountDto, DiscountState, DiscountType } from '@as/contracts';

import type { BadgeTone } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';

/** Who may see codes: those who manage them, and order staff (codes appear on orders). */
export const DISCOUNT_READ = ['discounts.write', 'orders.read'] as const;

export const DISCOUNT_TYPES: Record<DiscountType, { label: string; hint: string }> = {
  PERCENTAGE: { label: 'Percent off', hint: 'e.g. 15% off the items, optionally capped.' },
  FIXED_AMOUNT: { label: 'Amount off', hint: 'e.g. Rs 500 off the items.' },
  FREE_SHIPPING: { label: 'Free delivery', hint: 'The delivery fee is waived.' },
};

export const DISCOUNT_STATES: Record<DiscountState, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'gold' },
  expired: { label: 'Expired', tone: 'warning' },
  'used-up': { label: 'Used up', tone: 'warning' },
  inactive: { label: 'Off', tone: 'neutral' },
};

/** `15` / `12.5` → basis points (1500 / 1250); anything else → NaN; '' → null. */
export function percentToBasisPoints(input: string): number | null {
  const clean = input.replace(/[%\s]/g, '');
  if (!clean) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

/** 1500 → `15`, 1250 → `12.5`. */
export const basisPointsToPercent = (bp: number): string => String(bp / 100);

/** "15% off, up to Rs 1,000 · orders over Rs 3,000". */
export function discountSummary(
  d: Pick<AdminDiscountDto, 'type' | 'value' | 'maxDiscountMinor' | 'minSubtotalMinor'>,
): string {
  const offer =
    d.type === 'PERCENTAGE'
      ? `${basisPointsToPercent(d.value)}% off${d.maxDiscountMinor ? `, up to ${formatMoney(d.maxDiscountMinor)}` : ''}`
      : d.type === 'FIXED_AMOUNT'
        ? `${formatMoney(d.value)} off`
        : 'Free delivery';
  return d.minSubtotalMinor ? `${offer} · orders over ${formatMoney(d.minSubtotalMinor)}` : offer;
}

/** "3 of 100 used" / "3 used". */
export const usageText = (d: Pick<AdminDiscountDto, 'usageCount' | 'usageLimit'>) =>
  d.usageLimit === null
    ? `${String(d.usageCount)} used`
    : `${String(d.usageCount)} of ${String(d.usageLimit)} used`;

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A random, easy-to-read code (no 0/O or 1/I/L), e.g. `AS-7KQ4MX`. */
export function randomCode(random: () => number = Math.random): string {
  const part = Array.from({ length: 6 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]);
  return `AS-${part.join('')}`;
}
