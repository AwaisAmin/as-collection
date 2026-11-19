import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Track your order' };

// Temporary — order lookup by order number + phone arrives in F9.
export default function TrackOrderPage() {
  return (
    <PagePlaceholder
      title="Track your order"
      description="Order tracking by order number and phone is coming soon."
    />
  );
}
