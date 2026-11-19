import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header/header';
import { SkipLink } from '@/components/layout/skip-link';
import { TopBar } from '@/components/layout/top-bar';
import { WhatsAppButton } from '@/components/layout/whatsapp-button';
import { CartDrawer } from '@/features/cart/components/cart-drawer';
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
      <WhatsAppButton />
    </>
  );
}
