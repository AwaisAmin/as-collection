import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { CartView } from '@/features/cart/components/cart-view';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { RecentlyViewed } from '@/features/shop/components/recently-viewed';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';

export const metadata: Metadata = {
  title: 'Your Cart',
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  // Server-rendered suggestions, shown by the (client) cart view only when the cart is empty.
  const featured = await catalogService.getFeaturedProducts(4);

  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Your Cart"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Cart' }]}
      />
      <Container className="py-10">
        <CartView
          suggestions={
            <section aria-labelledby="suggestions-title">
              <div id="suggestions-title">
                <SectionHeading title="You may like" />
              </div>
              <ShopProductGrid products={featured} preloadCount={0} className="mt-10" />
            </section>
          }
        />
        <RecentlyViewed className="mt-20" />
      </Container>
    </main>
  );
}
