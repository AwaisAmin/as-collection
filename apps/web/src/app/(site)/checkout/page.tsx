import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
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
        <CheckoutView />
      </Container>
    </main>
  );
}
