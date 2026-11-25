import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatPrice, pluralize } from '@/lib/utils/format';

import type { CartTotals } from '../lib/cart-totals';

interface OrderSummaryProps {
  totals: CartTotals;
  /** Primary action (checkout / place order). */
  action?: ReactNode;
  title?: string;
  /** An applied discount code (checkout): shown as its own line, totals as the API priced them. */
  discount?: { code: string; amount: number; freeShipping: boolean; total: number } | null;
}

/** Subtotal, savings, delivery and total — shared by the cart page and checkout. */
export function OrderSummary({
  totals,
  action,
  title = 'Order summary',
  discount,
}: OrderSummaryProps) {
  const shipping = discount?.freeShipping ? 0 : totals.shipping;
  const total = discount ? discount.total : totals.total;
  return (
    <section
      aria-labelledby="order-summary-title"
      className="rounded-card border border-gold bg-ivory p-6 shadow-soft"
    >
      <h2 id="order-summary-title" className="font-display text-[24px]">
        {title}
      </h2>

      <dl className="mt-5 flex flex-col gap-3 font-body text-[17px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Subtotal ({pluralize(totals.itemCount, 'item')})</dt>
          <dd className="font-semibold text-ink">{formatPrice(totals.subtotal)}</dd>
        </div>
        {totals.savings > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">You save</dt>
            <dd className="font-semibold text-gold-dark">−{formatPrice(totals.savings)}</dd>
          </div>
        ) : null}
        {discount && discount.amount > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Discount ({discount.code})</dt>
            <dd className="font-semibold text-gold-dark">−{formatPrice(discount.amount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Delivery</dt>
          <dd className="font-semibold text-ink">
            {shipping === 0 ? 'Free' : formatPrice(shipping)}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-gold/50 pt-4">
          <dt className="font-display text-[20px] text-ink">Total</dt>
          <dd className="font-body text-[26px] font-bold text-ink">{formatPrice(total)}</dd>
        </div>
      </dl>

      {action ? <div className="mt-6">{action}</div> : null}

      <p className="mt-5 flex items-center justify-center gap-2 text-[14px] text-muted">
        <Lock aria-hidden size={14} />
        Cash on Delivery · Bank Transfer · JazzCash · Easypaisa
      </p>
    </section>
  );
}
