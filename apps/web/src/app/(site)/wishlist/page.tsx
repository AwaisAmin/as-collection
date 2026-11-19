import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false, follow: true } };

// Temporary — the wishlist page (saved products from the heart buttons) arrives in F9.
export default function WishlistPage() {
  return <PagePlaceholder title="Wishlist" description="Your saved favourites will appear here." />;
}
