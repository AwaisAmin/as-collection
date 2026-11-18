import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Your Cart' };

export default function CartPage() {
  return <PagePlaceholder title="Your Cart" />;
}
