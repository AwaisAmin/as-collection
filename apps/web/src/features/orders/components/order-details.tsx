import Image from 'next/image';
import Link from 'next/link';

import { transferAccounts } from '@/config/payments';
import { productHref } from '@/features/catalog/lib/routes';
import { formatDate, formatPrice } from '@/lib/utils/format';
import { formatPkMobile } from '@/lib/utils/phone';

import type { Order } from '../types';

export const paymentStatusLabel: Record<Order['payment']['status'], string> = {
  pay_on_delivery: 'Pay on delivery',
  awaiting_verification: 'Awaiting verification',
  paid: 'Paid',
  refunded: 'Refunded',
};

export const orderStatusLabel: Record<Order['status'], string> = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Items, totals, delivery and payment details of an order (confirmation, account, tracking). */
export function OrderDetails({ order }: { order: Order }) {
  const payment =
    order.payment.method === 'cod'
      ? 'Cash on Delivery'
      : `${order.payment.channel ? transferAccounts[order.payment.channel].label : 'Bank transfer'}${
          order.payment.transactionRef ? ` · Ref ${order.payment.transactionRef}` : ''
        }`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <section
        aria-labelledby="order-items-title"
        className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
      >
        <h2 id="order-items-title" className="font-display text-[20px]">
          Items ({order.totals.itemCount})
        </h2>
        <ul className="mt-3">
          {order.lines.map((line) => (
            <li
              key={line.variantId}
              className="flex gap-4 border-b border-gold/40 py-4 last:border-b-0"
            >
              <span className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-lg border border-gold/50 bg-sand">
                <Image src={line.image.src} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[16px]">
                <Link
                  href={productHref(line.slug)}
                  className="font-display text-ink hover:text-gold-dark"
                >
                  {line.name}
                </Link>
                {Object.keys(line.options).length > 0 ? (
                  <span className="text-muted">
                    {Object.entries(line.options)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </span>
                ) : null}
                <span className="text-muted">
                  {line.quantity} × {formatPrice(line.price)}
                </span>
              </div>
              <span className="font-body font-bold text-ink">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-2 border-t border-gold/50 pt-4 font-body text-[16px]">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPrice(order.totals.subtotal)}</dd>
          </div>
          {order.totals.savings > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">You saved</dt>
              <dd className="text-gold-dark">−{formatPrice(order.totals.savings)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{order.totals.shipping === 0 ? 'Free' : formatPrice(order.totals.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-gold/40 pt-2 text-[19px] font-bold">
            <dt>Total</dt>
            <dd>{formatPrice(order.totals.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col gap-6">
        <section
          aria-labelledby="order-delivery-title"
          className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
        >
          <h2 id="order-delivery-title" className="font-display text-[20px]">
            Delivery to
          </h2>
          <address className="mt-3 flex flex-col gap-0.5 text-[16px] text-text not-italic">
            <span className="font-bold">{order.customer.fullName}</span>
            <span>{order.shipping.address}</span>
            <span>
              {order.shipping.city}
              {order.shipping.postalCode ? ` ${order.shipping.postalCode}` : ''}
            </span>
            <span className="mt-1 text-muted">{formatPkMobile(order.customer.phone)}</span>
            {order.customer.email ? (
              <span className="text-muted">{order.customer.email}</span>
            ) : null}
          </address>
          {order.shipping.notes ? (
            <p className="mt-3 rounded-lg bg-sand/70 px-3 py-2 text-[15px] text-muted">
              Note: {order.shipping.notes}
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="order-payment-title"
          className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
        >
          <h2 id="order-payment-title" className="font-display text-[20px]">
            Payment
          </h2>
          <dl className="mt-3 flex flex-col gap-1.5 text-[16px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Method</dt>
              <dd className="text-right">{payment}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Status</dt>
              <dd className="font-bold text-gold-dark">
                {paymentStatusLabel[order.payment.status]}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Placed on</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
