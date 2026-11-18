import { CategorySection } from '@/features/home/components/categories/category-section';
import { Hero } from '@/features/home/components/hero/hero';
import { TrustBar } from '@/features/home/components/trust-bar/trust-bar';

/** Home page — composes the home feature sections in order. */
export default function HomePage() {
  return (
    <main id="main-content" className="flex-1">
      <Hero />
      <CategorySection />
      <TrustBar />
    </main>
  );
}
