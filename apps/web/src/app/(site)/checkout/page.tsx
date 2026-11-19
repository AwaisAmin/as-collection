import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';
import { authService } from '@/features/auth/services/auth.service';
import { getCurrentUser } from '@/features/auth/session';
import { CheckoutView } from '@/features/checkout/components/checkout-view';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Checkout"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Cart', href: '/cart' },
          { label: 'Checkout' },
        ]}
      />
      <Container className="py-10">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
              <Skeleton className="h-[600px] w-full rounded-card" />
              <Skeleton className="h-96 w-full rounded-card" />
            </div>
          }
        >
          <CheckoutWithAccount />
        </Suspense>
      </Container>
    </main>
  );
}

/** Reads the session (request-time) to prefill details for signed-in customers. */
async function CheckoutWithAccount() {
  const user = await getCurrentUser();
  if (!user) return <CheckoutView />;
  const addresses = await authService.listAddresses(user.id);
  return (
    <CheckoutView prefill={{ name: user.name, phone: user.phone, email: user.email, addresses }} />
  );
}
