import { OrganizationJsonLd } from '@/components/seo/organization-json-ld';
import { BestSellers } from '@/features/home/components/best-sellers/best-sellers';
import { CategorySection } from '@/features/home/components/categories/category-section';
import { Hero } from '@/features/home/components/hero/hero';
import { NewArrivals } from '@/features/home/components/new-arrivals/new-arrivals';
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
    </main>
  );
}
