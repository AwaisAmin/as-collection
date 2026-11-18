import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'My Account' };

export default function AccountPage() {
  return <PagePlaceholder title="My Account" />;
}
