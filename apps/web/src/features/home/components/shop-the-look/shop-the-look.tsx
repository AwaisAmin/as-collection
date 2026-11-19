import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { featuredLook, type Look } from '@/config/looks';
import { catalogService } from '@/features/catalog/services/catalog.service';

import { LookExplorer, type LookItem } from './look-explorer';

interface ShopTheLookProps {
  look?: Look | null;
}

/** A styled photo with numbered hotspots; each one reveals the product it points at. */
export async function ShopTheLook({ look = featuredLook }: ShopTheLookProps) {
  if (!look) return null;

  const products = await catalogService.getProductSummariesBySlug(
    look.hotspots.map((h) => h.productSlug),
  );
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const items: LookItem[] = look.hotspots.flatMap(({ productSlug, x, y }) => {
    const product = bySlug.get(productSlug);
    return product ? [{ product, x, y }] : [];
  });
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="look-title" className="bg-ivory py-16 lg:py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="look-title"
            title="Shop the Look"
            subtitle="Tap the dots to see every piece in this look."
          />
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <LookExplorer
            title={look.title}
            description={look.description}
            image={look.image}
            items={items}
          />
        </Reveal>
      </Container>
    </section>
  );
}
