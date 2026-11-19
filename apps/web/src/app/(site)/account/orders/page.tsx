import { ChevronRight, Package } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireUser } from '@/features/auth/session';
import { paymentStatusLabel } from '@/features/orders/components/order-details';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatDate, formatPrice, pluralize } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'My orders' };

export default async function AccountOrdersPage() {
  const user = await requireUser('/account/orders');
  const orders = await ordersService.listOrdersForCustomer({ userId: user.id, phone: user.phone });

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="When you place an order, you can track it here."
        action={
          <ButtonLink href="/shop" withArrow>
            Start shopping
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-[28px]">My orders</h2>
      <ul className="flex flex-col gap-4">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <Link
              href={`/account/orders/${o.orderNumber}` as Route}
              className="group flex flex-col gap-4 rounded-card border border-gold/60 bg-ivory p-5 transition-all hover:border-gold hover:shadow-soft sm:flex-row sm:items-center"
            >
              <div className="flex -space-x-3">
                {o.lines.slice(0, 3).map((line) => (
                  <span
                    key={line.variantId}
                    className="relative aspect-[3/4] w-14 overflow-hidden rounded-lg border-2 border-ivory bg-sand shadow-soft"
                  >
                    <Image src={line.image.src} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-bold text-ink">{o.orderNumber}</p>
                <p className="text-[15px] text-muted">
                  {formatDate(o.createdAt)} · {pluralize(o.totals.itemCount, 'item')} ·{' '}
                  {paymentStatusLabel[o.payment.status]}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <OrderStatusBadge status={o.status} />
                <span className="font-body text-[18px] font-bold">
                  {formatPrice(o.totals.total)}
                </span>
                <ChevronRight
                  aria-hidden
                  size={20}
                  className="text-gold-dark transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
