import type { AdminCustomerDto } from '@as/contracts';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AccountActions, CustomerEditForm } from '@/features/customers/components/customer-forms';
import { CUSTOMER_STATUS } from '@/features/customers/labels';
import { whatsappHref } from '@/features/inbox/labels';
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/components/order-badges';
import { PAYMENT_METHOD } from '@/features/orders/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { formatDate, formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Customer' };

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export default async function CustomerPage({ params }: PageProps<'/customers/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'customers.read')) {
    return <Alert tone="error">Your role does not include customers.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const customer = await apiFindOrNull<AdminCustomerDto>(`/admin/customers/${id}`, { token });
  if (!customer) notFound();
  const canWrite = can(permissions, 'customers.write');
  const canSeeOrders = can(permissions, 'orders.read');
  const status = CUSTOMER_STATUS[customer.status];
  const { stats } = customer;
  const tiles = [
    { label: 'Spent', value: formatMoney(stats.spentMinor), hint: 'Cancelled orders not counted' },
    { label: 'Orders', value: String(stats.orders), hint: `${stats.countedOrders} not cancelled` },
    { label: 'Reviews', value: String(stats.reviews), hint: 'Written by them' },
    { label: 'Signed in on', value: String(stats.activeSessions), hint: 'Devices right now' },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/customers"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Customers
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-[22px] font-semibold wrap-break-word">
              {customer.name ?? 'No name given'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
              <Badge tone={status.tone}>{status.label}</Badge>
              {customer.hasGoogle ? <Badge>Google sign-in</Badge> : null}
              <span>Joined {formatDate(customer.createdAt)}</span>
              <span>
                ·{' '}
                {customer.lastLoginAt
                  ? `last signed in ${formatDateTime(customer.lastLoginAt)}`
                  : 'never signed in'}
              </span>
            </div>
          </div>
          {canWrite ? <AccountActions customer={customer} /> : null}
        </div>
      </div>

      {customer.status === 'BLOCKED' ? (
        <Alert tone="error">
          Blocked{customer.blockedAt ? ` on ${formatDateTime(customer.blockedAt)}` : ''}
          {customer.blockedReason ? `: ${customer.blockedReason}` : ''}. They can’t sign in.
        </Alert>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="border-line bg-surface shadow-card rounded-card border p-4"
          >
            <dt className="text-[13px] text-muted">{tile.label}</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{tile.value}</dd>
            <dd className="text-[12px] text-muted">{tile.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Section
            title="Recent orders"
            aside={
              canSeeOrders && customer.phone && stats.orders > customer.recentOrders.length ? (
                <Link
                  href={`/orders?q=${encodeURIComponent(customer.phone)}` as Route}
                  className="text-[14px] underline-offset-4 hover:underline"
                >
                  All {stats.orders} orders
                </Link>
              ) : null
            }
          >
            {customer.recentOrders.length ? (
              <ul className="divide-line -my-2 flex flex-col divide-y">
                {customer.recentOrders.map((order) => (
                  <li
                    key={order.number}
                    className="relative flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      {canSeeOrders ? (
                        <Link
                          href={`/orders/${order.number}` as Route}
                          className="font-mono font-medium after:absolute after:inset-0 hover:underline"
                        >
                          {order.number}
                        </Link>
                      ) : (
                        <span className="font-mono font-medium">{order.number}</span>
                      )}
                      <p className="text-[13px] text-muted">
                        {formatDateTime(order.createdAt)} · {PAYMENT_METHOD[order.paymentMethod]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                      <span className="font-medium tabular-nums">
                        {formatMoney(order.totalMinor)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">No orders yet.</p>
            )}
          </Section>

          <Section title="Saved addresses">
            {customer.addresses.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="border-line rounded-lg border p-3 text-[14px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{address.label ?? address.fullName}</span>
                      {address.isDefault ? <Badge>Default</Badge> : null}
                    </div>
                    {address.label ? <p>{address.fullName}</p> : null}
                    <p className="wrap-break-word text-muted">
                      {[
                        address.line1,
                        address.line2,
                        address.city,
                        address.province,
                        address.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="text-muted tabular-nums">{formatPhone(address.phone)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">No saved addresses.</p>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Contact">
            <div className="flex flex-col gap-1 text-[14px]">
              {customer.phone ? (
                <p className="tabular-nums">
                  {formatPhone(customer.phone)}{' '}
                  <span className="text-muted">
                    {customer.phoneVerifiedAt ? '· verified' : '· not verified'}
                  </span>
                </p>
              ) : (
                <p className="text-muted">No mobile number</p>
              )}
              {customer.email ? (
                <p className="break-all">
                  {customer.email}{' '}
                  <span className="text-muted">
                    {customer.emailVerifiedAt ? '· verified' : '· not verified'}
                  </span>
                </p>
              ) : null}
            </div>
            {customer.phone ? (
              <div className="flex gap-2">
                <a
                  href={whatsappHref(customer.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses('secondary', 'sm', 'flex-1')}
                >
                  <MessageCircle aria-hidden size={15} />
                  WhatsApp
                </a>
                <a
                  href={`tel:${customer.phone}`}
                  className={buttonClasses('secondary', 'sm', 'flex-1')}
                >
                  <Phone aria-hidden size={15} />
                  Call
                </a>
              </div>
            ) : null}
          </Section>

          <Section title="Details">
            {/* Remounts after each save so the form starts from what was stored. */}
            <CustomerEditForm key={customer.updatedAt} customer={customer} canWrite={canWrite} />
          </Section>
        </div>
      </div>
    </div>
  );
}
