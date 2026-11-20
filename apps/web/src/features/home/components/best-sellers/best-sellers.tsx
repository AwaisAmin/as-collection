import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { type TabItem, Tabs } from '@/components/ui/tabs';
import { categories } from '@/config/catalog';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';

/** Top products per category behind pill tabs. All panels render on the server (cached). */
interface BestSellersProps {
  title?: string;
  subtitle?: string;
  /** Tabs in this order (unknown slugs are skipped); default: every category. */
  categorySlugs?: readonly string[];
  limit?: number;
}

export async function BestSellers({
  title = 'Best Sellers',
  subtitle = 'The pieces our customers keep coming back for.',
  categorySlugs,
  limit = 4,
}: BestSellersProps = {}) {
  const tabs = categorySlugs
    ? categorySlugs.flatMap((slug) => categories.filter((c) => c.slug === slug))
    : categories;
  const perCategory = await Promise.all(
    tabs.map(async (category) => ({
      category,
      products: await catalogService.getBestSellers(category.slug, limit),
    })),
  );

  const items: TabItem[] = perCategory
    .filter(({ products }) => products.length > 0)
    .map(({ category, products }) => ({
      id: category.slug,
      label: category.titleLines[0] ?? category.name,
      content: (
        <div className="flex flex-col items-center gap-10">
          <ShopProductGrid products={products} preloadCount={0} empty={null} className="w-full" />
          <ButtonLink href={category.href} withArrow>
            Shop all {category.name}
          </ButtonLink>
        </div>
      ),
    }));

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="best-sellers-title" className="bg-ivory py-16 lg:py-20">
      <Container>
        <Reveal>
          <SectionHeading id="best-sellers-title" title={title} subtitle={subtitle} />
        </Reveal>
        <Reveal delay={120} className="mt-8">
          <Tabs items={items} label="Best sellers by category" variant="pills" />
        </Reveal>
      </Container>
    </section>
  );
}
