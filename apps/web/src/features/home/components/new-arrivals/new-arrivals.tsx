import type { Route } from 'next';

import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Carousel } from '@/components/ui/carousel';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductCard } from '@/features/shop/components/shop-product-card';

/** Newest in-stock products as a swipeable carousel. Hidden when there is nothing new. */
export async function NewArrivals() {
  const products = await catalogService.getNewArrivals(8);
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="new-arrivals-title" className="bg-cream py-16 lg:py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="new-arrivals-title"
            title="New Arrivals"
            subtitle="Fresh lawn, festive formals and beauty picks — just landed."
          />
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <Carousel label="Latest products">
            {products.map((product) => (
              <ShopProductCard key={product.id} product={product} />
            ))}
          </Carousel>
        </Reveal>
        <div className="mt-10 flex justify-center">
          <ButtonLink href={'/shop?sort=newest' as Route} withArrow>
            View all new arrivals
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
