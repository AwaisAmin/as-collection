import { Truck } from 'lucide-react';

import { formatPrice } from '@/lib/utils/format';

import type { CartTotals } from '../lib/cart-totals';

export function FreeShippingProgress({ totals }: { totals: CartTotals }) {
  if (totals.itemCount === 0) return null;
  const percent = Math.round(totals.freeShippingProgress * 100);

  return (
    <div className="rounded-xl border border-gold/60 bg-sand/70 px-4 py-3">
      <p className="flex items-center gap-2 font-body text-[16px] text-text">
        <Truck aria-hidden size={18} className="shrink-0 text-gold-dark" />
        {totals.qualifiesForFreeShipping ? (
          <span>
            <span className="font-bold">You&apos;ve unlocked free delivery!</span>
          </span>
        ) : (
          <span>
            Add <span className="font-bold">{formatPrice(totals.freeShippingRemaining)}</span> more
            for <span className="font-bold">free delivery</span>
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-ivory ring-1 ring-gold/40"
      >
        <div
          className="h-full rounded-full bg-gold-gradient transition-[width] duration-500 ease-elegant"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
