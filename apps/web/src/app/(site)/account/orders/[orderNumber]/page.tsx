import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUser } from '@/features/auth/session';
import { OrderDetails } from '@/features/orders/components/order-details';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { ORDER_NUMBER_PATTERN } from '@/features/orders/lib/order-number';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatDate } from '@/lib/utils/format';

export async function generateMetadata({
  params,
}: PageProps<'/account/orders/[orderNumber]'>): Promise<Metadata> {
  return { title: `Order ${(await params).orderNumber}` };
}

export default async function AccountOrderPage({
  params,
}: PageProps<'/account/orders/[orderNumber]'>) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${orderNumber}`);
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  // Authorization: only the account that owns the order (by user id or verified phone).
  const order = await ordersService.getOrderForAccount(orderNumber, {
    userId: user.id,
    phone: user.phone,
  });
  if (!order) notFound();

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
        <OrderStatusBadge status={order.status} className="text-[15px]" />
      </div>
      <OrderDetails order={order} />
    </div>
  );
}
