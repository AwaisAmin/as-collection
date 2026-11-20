import type { AdminOrderDto } from '@as/contracts';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { env } from '@/config/env';
import { NoteForm } from '@/features/orders/components/note-form';
import { OrderActions } from '@/features/orders/components/order-actions';
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/components/order-badges';
import { OrderTimeline } from '@/features/orders/components/order-timeline';
import { PaymentProofs } from '@/features/orders/components/payment-proofs';
import { ACTIONS, PAYMENT_METHOD } from '@/features/orders/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export async function generateMetadata({
  params,
}: PageProps<'/orders/[number]'>): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

const ORDER_NUMBER = /^AS-\d{6}-[23456789A-HJKMNP-Z]{5}$/;

/** Product images may be stored relative to the storefront (`/media/…`). */
const imageSrc = (url: string) =>
  url.startsWith('/') ? new URL(url, env.STOREFRONT_URL).href : url;

/** `+923001234567` → `https://wa.me/923001234567`. */
const whatsapp = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

const contactLink =
  'border-line hover:bg-canvas inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border text-[14px]';

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export default async function OrderPage({ params }: PageProps<'/orders/[number]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'orders.read')) {
    return <Alert tone="error">Your role does not include orders.</Alert>;
  }
  const { number } = await params;
  if (!ORDER_NUMBER.test(number)) notFound();
  const order = await apiFindOrNull<AdminOrderDto>(`/admin/orders/${number}`, { token });
  if (!order) notFound();

  const actions = order.actions.filter((action) => can(permissions, ACTIONS[action].permission));
  const { totals, shipping, customer, delivery } = order;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/orders"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Orders
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-mono text-[22px] font-semibold">{order.number}</h1>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
              <span>Placed {formatDateTime(order.placedAt)}</span>
            </div>
          </div>
          <p className="text-[22px] font-semibold tabular-nums">{formatMoney(totals.totalMinor)}</p>
        </div>
      </div>

      {actions.length ? (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-[16px] font-semibold">Next step</h2>
          {order.canReviewPayment && !order.actions.includes('confirm') ? (
            <p className="text-[14px] text-muted">
              This order is paid by transfer: accept the payment below to confirm it.
            </p>
          ) : null}
          <OrderActions number={order.number} actions={actions} delivery={delivery} />
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Section title={`Items (${String(totals.itemCount)})`}>
            <ul className="divide-line flex flex-col divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0">
                  <div className="border-line bg-canvas size-16 shrink-0 overflow-hidden rounded-md border">
                    {item.imageUrl ? (
                      // Small thumbnails from the media host; not worth the image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageSrc(item.imageUrl)}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[14px]">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-muted">
                      {[item.variantTitle, `SKU ${item.sku}`].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-muted tabular-nums">
                      {item.quantity} × {formatMoney(item.unitPriceMinor)}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">{formatMoney(item.lineTotalMinor)}</p>
                </li>
              ))}
            </ul>
            <dl className="border-line grid grid-cols-[1fr_auto] gap-y-1.5 border-t pt-4 text-[14px] tabular-nums">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-right">{formatMoney(totals.subtotalMinor)}</dd>
              {totals.discountMinor ? (
                <>
                  <dt className="text-muted">
                    Discount{order.discountCode ? ` (${order.discountCode})` : ''}
                  </dt>
                  <dd className="text-right">{formatMoney(-totals.discountMinor)}</dd>
                </>
              ) : null}
              <dt className="text-muted">Delivery</dt>
              <dd className="text-right">
                {totals.shippingMinor ? formatMoney(totals.shippingMinor) : 'Free'}
              </dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{formatMoney(totals.totalMinor)}</dd>
            </dl>
          </Section>

          <Section
            title="Payment"
            aside={
              <span className="text-[14px] text-muted">{PAYMENT_METHOD[order.paymentMethod]}</span>
            }
          >
            {order.paymentMethod === 'COD' ? (
              <p className="text-[14px] text-muted">
                The courier collects {formatMoney(totals.totalMinor)} in cash. The order is marked
                paid when it is delivered.
              </p>
            ) : (
              <PaymentProofs order={order} canReview={can(permissions, 'payments.review')} />
            )}
          </Section>

          <Section title="Timeline">
            {can(permissions, 'orders.write') ? <NoteForm number={order.number} /> : null}
            <OrderTimeline events={order.timeline} />
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Customer">
            <div className="flex flex-col gap-1 text-[14px]">
              <p className="font-medium">{customer.fullName}</p>
              <p className="tabular-nums">{formatPhone(customer.phone)}</p>
              {customer.email ? <p className="break-all text-muted">{customer.email}</p> : null}
              <p className="text-muted">{order.customerId ? 'Has an account' : 'Guest checkout'}</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${customer.phone}`} className={contactLink}>
                <Phone aria-hidden size={16} />
                Call
              </a>
              <a
                href={whatsapp(customer.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className={contactLink}
              >
                <MessageCircle aria-hidden size={16} />
                WhatsApp
              </a>
            </div>
          </Section>

          <Section title="Deliver to">
            <address className="flex flex-col gap-0.5 text-[14px] not-italic">
              <span className="font-medium">{shipping.fullName}</span>
              <span className="tabular-nums">{formatPhone(shipping.phone)}</span>
              <span>{shipping.line1}</span>
              {shipping.line2 ? <span>{shipping.line2}</span> : null}
              <span>
                {[shipping.city, shipping.province, shipping.postalCode].filter(Boolean).join(', ')}
              </span>
            </address>
            {order.notes ? (
              <div className="bg-canvas rounded-lg px-3 py-2 text-[14px]">
                <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">
                  Customer note
                </p>
                <p className="whitespace-pre-line">{order.notes}</p>
              </div>
            ) : null}
          </Section>

          {delivery.courier || delivery.trackingNumber ? (
            <Section title="Shipment">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
                <dt className="text-muted">Courier</dt>
                <dd>{delivery.courier ?? '—'}</dd>
                <dt className="text-muted">Tracking</dt>
                <dd className="font-mono break-all">{delivery.trackingNumber ?? '—'}</dd>
                {order.shippedAt ? (
                  <>
                    <dt className="text-muted">Shipped</dt>
                    <dd>{formatDateTime(order.shippedAt)}</dd>
                  </>
                ) : null}
                {order.deliveredAt ? (
                  <>
                    <dt className="text-muted">Delivered</dt>
                    <dd>{formatDateTime(order.deliveredAt)}</dd>
                  </>
                ) : null}
              </dl>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
