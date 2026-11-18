import { Hero } from '@/features/home/components/hero/hero';

/** Home page — composes the home feature sections in order. */
export default function HomePage() {
  return (
    <main id="main-content" className="flex-1">
      <Hero />
    </main>
  );
}
