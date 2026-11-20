import type { ProductStatus } from '@as/contracts';

import type { BadgeTone } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';

export const PRODUCT_STATUS: Record<
  ProductStatus,
  { label: string; tone: BadgeTone; hint: string }
> = {
  ACTIVE: { label: 'Active', tone: 'success', hint: 'Shown in the shop.' },
  DRAFT: { label: 'Draft', tone: 'neutral', hint: 'Hidden while you prepare it.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', hint: 'Hidden; kept for past orders.' },
};

/** `Rs 2,490` or `Rs 2,490 – Rs 3,100`; '—' before any active variant. */
export function priceRange(min: number | null, max: number | null): string {
  if (min === null) return '—';
  return max !== null && max !== min
    ? `${formatMoney(min)} – ${formatMoney(max)}`
    : formatMoney(min);
}
