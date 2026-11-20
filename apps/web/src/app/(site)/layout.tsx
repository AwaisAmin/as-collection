import { Suspense } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header/header';
import { SkipLink } from '@/components/layout/skip-link';
import { TopBar } from '@/components/layout/top-bar';
import { WhatsAppButton } from '@/components/layout/whatsapp-button';
import { CartDrawer } from '@/features/cart/components/cart-drawer';
import { ShippingRulesSync } from '@/features/cart/components/shipping-rules-sync';
import { getShippingRules } from '@/features/cart/services/shipping-rules';
import { NewsletterSection } from '@/features/newsletter/components/newsletter-section';

/** Storefront chrome shared by all customer-facing pages. */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SkipLink />
      <TopBar />
      <Header />
      {children}
      <NewsletterSection />
      <Footer />
      <CartDrawer />
      <Suspense fallback={null}>
        <ShippingRules />
      </Suspense>
      <WhatsAppButton />
    </>
  );
}

/** Delivery fee and free-delivery threshold from the store settings (cached). */
async function ShippingRules() {
  return <ShippingRulesSync rules={await getShippingRules()} />;
}
