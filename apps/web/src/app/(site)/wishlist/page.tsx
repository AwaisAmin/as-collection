import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';
import { WishlistView } from '@/features/shop/components/wishlist-view';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false, follow: true } };

export default async function WishlistPage() {
  const featured = await catalogService.getFeaturedProducts(4);

  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Wishlist"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]}
      />
      <Container className="py-10">
        <WishlistView
          suggestions={
            <section aria-labelledby="wishlist-suggestions">
              <div id="wishlist-suggestions">
                <SectionHeading title="You may like" />
              </div>
              <ShopProductGrid products={featured} preloadCount={0} className="mt-10" />
            </section>
          }
        />
      </Container>
    </main>
  );
}
