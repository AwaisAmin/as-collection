import { OrganizationJsonLd } from '@/components/seo/organization-json-ld';
import { BestSellers } from '@/features/home/components/best-sellers/best-sellers';
import { BrandStory } from '@/features/home/components/brand-story/brand-story';
import { CategorySection } from '@/features/home/components/categories/category-section';
import { Hero } from '@/features/home/components/hero/hero';
import { InstagramGallery } from '@/features/home/components/instagram-gallery/instagram-gallery';
import { NewArrivals } from '@/features/home/components/new-arrivals/new-arrivals';
import { SaleBanner } from '@/features/home/components/sale-banner/sale-banner';
import { ShopByOccasion } from '@/features/home/components/shop-by-occasion/shop-by-occasion';
import { ShopTheLook } from '@/features/home/components/shop-the-look/shop-the-look';
import { Testimonials } from '@/features/home/components/testimonials/testimonials';
import { TrustBar } from '@/features/home/components/trust-bar/trust-bar';

/** Home page — composes the home feature sections in order. */
export default function HomePage() {
  return (
    <main id="main-content" className="flex-1">
      <OrganizationJsonLd />
      <Hero />
      <CategorySection />
      <TrustBar />
      <NewArrivals />
      <BestSellers />
      <SaleBanner />
      <ShopByOccasion />
      <ShopTheLook />
      <Testimonials />
      <BrandStory />
      <InstagramGallery />
    </main>
  );
}
