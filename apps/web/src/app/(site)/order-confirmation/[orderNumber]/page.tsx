import { CircleCheck, Clock, PackageSearch } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';
import { siteConfig } from '@/config/site';
import { OrderDetails } from '@/features/orders/components/order-details';
import { ORDER_NUMBER_PATTERN } from '@/features/orders/lib/order-number';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatPrice } from '@/lib/utils/format';
import { formatPkMobile } from '@/lib/utils/phone';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

export default function OrderConfirmationPage(
  props: PageProps<'/order-confirmation/[orderNumber]'>,
) {
  return (
    <main id="main-content" className="flex-1">
      <Suspense
        fallback={
          <Container className="flex flex-col items-center gap-5 py-16">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-10 w-80 max-w-full" />
            <Skeleton className="h-64 w-full rounded-card" />
          </Container>
        }
      >
        <Confirmation {...props} />
      </Suspense>
    </main>
  );
}

async function Confirmation({
  params,
  searchParams,
}: PageProps<'/order-confirmation/[orderNumber]'>) {
  const { orderNumber } = await params;
  const key = (await searchParams).key;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber) || typeof key !== 'string') notFound();

  // Private: requires the secret key from the checkout redirect (not cached).
  const order = await ordersService.getOrderForCustomer(orderNumber, key);
  if (!order) notFound();

  const firstName = order.customer.fullName.split(' ')[0];
  const isCod = order.payment.method === 'cod';
  const trackHref =
    `/track-order?order=${order.orderNumber}&phone=${order.customer.phone}` as Route;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="flex size-20 items-center justify-center rounded-full border-2 border-gold bg-ivory shadow-soft">
          <CircleCheck aria-hidden className="size-10 text-gold-dark" strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-[34px]/[1.15] sm:text-[42px]/[1.15]">
          Thank you, {firstName}!
        </h1>
        <p className="text-[19px] text-muted">
          Your order has been placed. We&apos;ll contact you on{' '}
          <span className="font-semibold text-ink">{formatPkMobile(order.customer.phone)}</span> to
          confirm it before dispatch.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 rounded-full border border-gold bg-ivory px-5 py-2.5">
          <span className="text-[16px] text-muted">Order number</span>
          <span className="font-body text-[20px] font-bold tracking-wide text-ink">
            {order.orderNumber}
          </span>
          <CopyButton value={order.orderNumber} label="order number" />
        </div>

        <div className="mt-2 flex w-full gap-3 rounded-xl border border-gold/60 bg-sand/70 px-4 py-3 text-left text-[16px]">
          <Clock aria-hidden size={20} className="mt-0.5 shrink-0 text-gold-dark" />
          {isCod ? (
            <p>
              Please keep <span className="font-bold">{formatPrice(order.totals.total)}</span> ready
              in cash for the courier. Delivery usually takes 2–5 working days.
            </p>
          ) : (
            <p>
              We received your payment screenshot. Your order will be confirmed once we verify the
              payment — usually within a few hours.
            </p>
          )}
        </div>
      </div>

      <div className="mt-12">
        <OrderDetails order={order} />
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop" withArrow>
          Continue shopping
        </ButtonLink>
        <ButtonLink href={trackHref} variant="ghost" className="gap-2 border-[1.5px] border-gold">
          <PackageSearch aria-hidden size={18} />
          Track your order
        </ButtonLink>
      </div>

      <p className="mt-8 text-center text-[15px] text-muted">
        Questions? Call us on {siteConfig.contact.phone} or email {siteConfig.contact.email}.
      </p>
    </Container>
  );
}
