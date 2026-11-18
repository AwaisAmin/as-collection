import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Contact Us' };

export default function ContactPage() {
  return <PagePlaceholder title="Contact Us" />;
}
