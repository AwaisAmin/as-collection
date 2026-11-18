import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'About Us' };

export default function AboutPage() {
  return <PagePlaceholder title="About Us" />;
}
