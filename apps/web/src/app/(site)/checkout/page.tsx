import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

// Temporary — delivery details, payment (COD / bank transfer) and order confirmation arrive in F7.
export default function CheckoutPage() {
  return (
    <PagePlaceholder title="Checkout" description="Secure checkout is coming in the next step." />
  );
}
