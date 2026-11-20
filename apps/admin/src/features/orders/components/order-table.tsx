import type { AdminOrderListItemDto } from '@as/contracts';
import type { Route } from 'next';
import Link from 'next/link';

import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';

import { PAYMENT_METHOD } from '../labels';
import { OrderStatusBadge, PaymentStatusBadge } from './order-badges';

const href = (order: AdminOrderListItemDto) => `/orders/${order.number}` as Route;

/** Orders as a table on wide screens and as cards on phones (same links, same data). */
export function OrderTable({ orders }: { orders: readonly AdminOrderListItemDto[] }) {
  return (
    <>
      <div className="border-line bg-surface shadow-card relative hidden overflow-x-auto rounded-card border md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-line bg-canvas/60 border-b text-[12px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                Order
              </th>
              <th scope="col" className="px-4 py-3">
                Customer
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Payment
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-canvas/50 relative">
                <td className="px-4 py-3">
                  <Link
                    href={href(order)}
                    className="font-mono font-medium after:absolute after:inset-0 hover:underline"
                  >
                    {order.number}
                  </Link>
                  <p className="text-[13px] text-muted">{formatDateTime(order.placedAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-[13px] text-muted">
                    {formatPhone(order.phone)} · {order.city}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <PaymentStatusBadge status={order.paymentStatus} />
                    <span className="text-[13px] text-muted">
                      {PAYMENT_METHOD[order.paymentMethod]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium tabular-nums">{formatMoney(order.totalMinor)}</p>
                  <p className="text-[13px] text-muted">
                    {order.lineCount} {order.lineCount === 1 ? 'item' : 'items'}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={href(order)}
              className="border-line bg-surface shadow-card flex flex-col gap-2 rounded-card border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-medium">{order.number}</p>
                  <p className="text-[13px] text-muted">{formatDateTime(order.placedAt)}</p>
                </div>
                <p className="font-medium tabular-nums">{formatMoney(order.totalMinor)}</p>
              </div>
              <p className="text-[14px]">
                {order.customerName}
                <span className="text-muted"> · {order.city}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
                <span className="text-[13px] text-muted">
                  {PAYMENT_METHOD[order.paymentMethod]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
