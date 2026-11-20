import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header/header';
import { SkipLink } from '@/components/layout/skip-link';
import { TopBar } from '@/components/layout/top-bar';
import { WhatsAppButton } from '@/components/layout/whatsapp-button';
import { CartDrawer } from '@/features/cart/components/cart-drawer';
import { ShippingRulesSync } from '@/features/cart/components/shipping-rules-sync';
import { StoreContentProvider } from '@/features/content/components/store-content-provider';
import { getStoreContent } from '@/features/content/services/store-content';
import { NewsletterSection } from '@/features/newsletter/components/newsletter-section';

/**
 * Storefront chrome shared by all customer-facing pages. Store settings and menus come from the
 * API (cached, refreshed when staff save) and reach client components through the provider.
 */
export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const content = await getStoreContent();
  const { settings } = content;
  return (
    <StoreContentProvider value={content}>
      <SkipLink />
      <TopBar announcements={settings.announcements} socials={settings.socials} />
      <Header />
      {children}
      <NewsletterSection />
      <Footer settings={settings} links={content.menus.footer} />
      <CartDrawer />
      <WhatsAppButton />
      <ShippingRulesSync
        rules={{
          shippingFee: settings.shipping.shippingFee,
          freeShippingThreshold: settings.shipping.freeShippingThreshold,
        }}
      />
    </StoreContentProvider>
  );
}
