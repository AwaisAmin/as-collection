import { PackageSearch, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Form from 'next/form';
import Image from 'next/image';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { siteConfig } from '@/config/site';
import { paymentStatusLabel } from '@/features/orders/components/order-details';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { OrderTimeline } from '@/features/orders/components/order-timeline';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatDate, formatPrice, pluralize } from '@/lib/utils/format';
import { formatPkMobile, normalizePkMobile } from '@/lib/utils/phone';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Check the status of your AS Collection Hub order with your order number and phone.',
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

export default function TrackOrderPage({ searchParams }: PageProps<'/track-order'>) {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Track your order"
        subtitle="Enter your order number and the mobile number used at checkout."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Track order' }]}
      />
      <Container className="py-10">
        <Suspense fallback={<Skeleton className="mx-auto h-56 w-full max-w-2xl rounded-card" />}>
          <Tracker searchParams={searchParams} />
        </Suspense>
      </Container>
    </main>
  );
}

async function Tracker({ searchParams }: Pick<PageProps<'/track-order'>, 'searchParams'>) {
  const params = await searchParams;
  const orderNumber = first(params.order).toUpperCase();
  const rawPhone = first(params.phone);
  const normalized = normalizePkMobile(rawPhone);
  const phone = normalized ? formatPkMobile(normalized) : rawPhone;
  const submitted = orderNumber !== '' || phone !== '';

  // Public lookup needs BOTH order number and phone, and shows no full address.
  const order =
    orderNumber && phone ? await ordersService.findOrderByNumberAndPhone(orderNumber, phone) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Form
        action="/track-order"
        className="grid grid-cols-1 gap-4 rounded-card border border-gold bg-ivory p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6"
      >
        <label className="flex flex-col gap-1.5">
          <span className="px-1 font-display text-[16px]">Order number</span>
          <Input
            name="order"
            defaultValue={orderNumber}
            placeholder="AS-261119-XXXXX"
            maxLength={20}
            required
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="px-1 font-display text-[16px]">Mobile number</span>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={phone}
            placeholder="03XX-XXXXXXX"
            maxLength={16}
            required
            autoComplete="tel"
          />
        </label>
        <Button type="submit" className="h-10.5">
          <PackageSearch aria-hidden size={17} />
          Track
        </Button>
      </Form>

      {submitted && !order ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gold/70 bg-ivory px-6 py-10 text-center"
        >
          <SearchX aria-hidden className="size-10 text-gold-dark" strokeWidth={1.5} />
          <p className="font-display text-[22px]">We couldn&apos;t find that order</p>
          <p className="max-w-md text-[17px] text-muted">
            Please check the order number and the mobile number you used at checkout. Need help?
            Call {siteConfig.contact.phone}.
          </p>
        </div>
      ) : null}

      {order ? (
        <section
          aria-labelledby="tracked-order"
          className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]"
        >
          <div className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="tracked-order" className="font-display text-[24px]">
                  {order.orderNumber}
                </h2>
                <p className="text-[15px] text-muted">Placed on {formatDate(order.createdAt)}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <OrderTimeline status={order.status} />
          </div>

          <aside className="flex flex-col gap-4 rounded-card border border-gold/60 bg-ivory p-5">
            <h3 className="font-display text-[19px]">Summary</h3>
            <ul className="flex flex-col gap-3">
              {order.lines.map((l) => (
                <li key={l.variantId} className="flex items-center gap-3 text-[15px]">
                  <span className="relative aspect-3/4 w-11 shrink-0 overflow-hidden rounded-md border border-gold/40">
                    <Image src={l.image.src} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="min-w-0 leading-snug">
                    <span className="block truncate text-ink">{l.name}</span>
                    <span className="text-muted">× {l.quantity}</span>
                  </span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1.5 border-t border-gold/40 pt-3 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-muted">Items</dt>
                <dd>{pluralize(order.totals.itemCount, 'item')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Total</dt>
                <dd className="font-bold">{formatPrice(order.totals.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Payment</dt>
                <dd>{paymentStatusLabel[order.payment.status]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Delivering to</dt>
                <dd>{order.shipping.city}</dd>
              </div>
            </dl>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
