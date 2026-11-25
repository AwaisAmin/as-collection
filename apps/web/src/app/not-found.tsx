import type { Metadata } from 'next';

import { NotFoundView } from '@/components/shared/status-views';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/** Unmatched URLs (rendered in the root layout). Store pages use (site)/not-found.tsx. */
export default function NotFound() {
  return <NotFoundView />;
}
