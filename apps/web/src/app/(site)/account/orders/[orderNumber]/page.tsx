import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { getSessionToken, requireSession } from '@/features/auth/session';
import { CancelOrderButton, PaymentProofForm } from '@/features/orders/components/order-actions';
import { OrderDetails } from '@/features/orders/components/order-details';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { ORDER_NUMBER_PATTERN } from '@/features/orders/lib/order-number';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatDate } from '@/lib/utils/format';

/** The signed-in shopper's order (one API call per request, shared by the title and the page). */
const loadOrder = cache(async (orderNumber: string, token: string) =>
  ORDER_NUMBER_PATTERN.test(orderNumber) ? ordersService.getOrder(orderNumber, { token }) : null,
);

export async function generateMetadata({
  params,
}: PageProps<'/account/orders/[orderNumber]'>): Promise<Metadata> {
  const { orderNumber } = await params;
  const token = await getSessionToken();
  const order = token ? await loadOrder(orderNumber, token) : null;
  // Someone else's or a mistyped number renders the 404 view: the tab says so too.
  return order
    ? { title: `Order ${orderNumber}` }
    : { title: 'Page not found', robots: { index: false } };
}

export default async function AccountOrderPage({
  params,
}: PageProps<'/account/orders/[orderNumber]'>) {
  const { orderNumber } = await params;
  const { token } = await requireSession(`/account/orders/${orderNumber}`);
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  // Authorization: the API only returns the session's own orders (by account or verified phone).
  const order = await loadOrder(orderNumber, token);
  if (!order) notFound();
  const needsScreenshot =
    order.actions?.canUploadPaymentProof === true &&
    (order.payment.status === 'awaiting_payment' || order.payment.status === 'payment_failed');

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/account/orders"
        className="inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-gold-dark hover:underline"
      >
        <ArrowLeft aria-hidden size={16} />
        All orders
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px]">Order {order.orderNumber}</h2>
          <p className="text-[16px] text-muted">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {order.actions?.canCancel ? <CancelOrderButton orderNumber={order.orderNumber} /> : null}
          <OrderStatusBadge status={order.status} className="text-[15px]" />
        </div>
      </div>
      {needsScreenshot ? (
        <PaymentProofForm
          orderNumber={order.orderNumber}
          rejected={order.payment.status === 'payment_failed'}
          rejectionReason={order.payment.proofRejectionReason}
          channel={order.payment.channel}
          total={order.totals.total}
        />
      ) : null}
      <OrderDetails order={order} />
    </div>
  );
}
