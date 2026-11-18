import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Shop' };

export default function ShopPage() {
  return <PagePlaceholder title="Shop" description="Our full collection is coming soon." />;
}
