import type { ContentLink, ProductSource } from '@as/contracts';
import type { Route } from 'next';

import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Carousel } from '@/components/ui/carousel';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductCard } from '@/features/shop/components/shop-product-card';

interface ProductCarouselProps {
  /** Unique per page: several carousels can appear on one page. */
  id: string;
  title: string;
  subtitle?: string;
  source: ProductSource;
  limit: number;
  cta?: ContentLink;
}

/**
 * A swipeable row of products from a section's source (newest, bestsellers, on sale, a
 * collection or a category). Hidden when the source has nothing to show.
 */
export async function ProductCarousel({
  id,
  title,
  subtitle,
  source,
  limit,
  cta,
}: ProductCarouselProps) {
  const products = await catalogService.getProductsBySource(source, limit);
  if (products.length === 0) return null;
  const headingId = `carousel-${id}-title`;

  return (
    <section aria-labelledby={headingId} className="bg-cream py-16 lg:py-20">
      <Container>
        <Reveal>
          <SectionHeading id={headingId} title={title} subtitle={subtitle} />
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <Carousel label={title}>
            {products.map((product) => (
              <ShopProductCard key={product.id} product={product} />
            ))}
          </Carousel>
        </Reveal>
        {cta ? (
          <div className="mt-10 flex justify-center">
            <ButtonLink href={cta.href as Route} withArrow>
              {cta.label}
            </ButtonLink>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
