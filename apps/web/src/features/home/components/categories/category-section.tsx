import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { categories as allCategories, type Category } from '@/config/catalog';

import { CategoryCard } from './category-card';

interface CategorySectionProps {
  categories?: readonly Category[];
}

/** 3-up category cards (2-up on tablet with the odd card centered, 1-up on mobile). */
export function CategorySection({ categories = allCategories }: CategorySectionProps) {
  return (
    <section aria-labelledby="categories-title" className="py-6">
      <h2 id="categories-title" className="sr-only">
        Shop by category
      </h2>
      <Container className="px-4 sm:px-5">
        <ul className="mx-auto grid max-w-xl grid-cols-1 gap-4 md:max-w-none md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, i) => (
            <Reveal
              as="li"
              delay={i * 120}
              key={category.slug}
              className="md:last:odd:col-span-2 md:last:odd:mx-auto md:last:odd:w-[calc(50%-8px)] lg:last:odd:col-span-1 lg:last:odd:w-full"
            >
              <CategoryCard category={category} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
