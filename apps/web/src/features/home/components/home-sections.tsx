import type { TypedSectionDto } from '@as/contracts';
import type { Route } from 'next';

import { Container } from '@/components/ui/container';
import { occasions } from '@/config/occasions';
import { getAllCategories } from '@/features/catalog/services/categories';
import type { StoreSettings } from '@/features/content/types';
import { RecentlyViewed } from '@/features/shop/components/recently-viewed';

import { toTrustFeatures } from '../content/trust-features';
import { BestSellers } from './best-sellers/best-sellers';
import { BrandStory } from './brand-story/brand-story';
import { CategorySection } from './categories/category-section';
import { Hero } from './hero/hero';
import { InstagramGallery } from './instagram-gallery/instagram-gallery';
import { ProductCarousel } from './product-carousel/product-carousel';
import { SaleBanner } from './sale-banner/sale-banner';
import { ShopByOccasion } from './shop-by-occasion/shop-by-occasion';
import { ShopTheLook } from './shop-the-look/shop-the-look';
import { Testimonials } from './testimonials/testimonials';
import { TrustBar } from './trust-bar/trust-bar';

/** Items in the order the section lists them; slugs this storefront has no artwork for are skipped. */
const pick = <T extends { slug: string }>(all: readonly T[], slugs: readonly string[]) =>
  slugs.flatMap((slug) => all.filter((item) => item.slug === slug));

/** One page section → its component, configured by the section's settings. */
async function Section({
  section,
  settings,
}: {
  section: TypedSectionDto;
  settings: StoreSettings;
}) {
  switch (section.type) {
    case 'hero':
      return <Hero />;
    case 'category-grid':
      // The admin's categories (with their pictures), in the order the section lists them.
      return (
        <CategorySection
          categories={pick(await getAllCategories(), section.settings.categorySlugs)}
        />
      );
    case 'trust-bar':
      return <TrustBar features={toTrustFeatures(settings.trustFeatures)} />;
    case 'product-carousel':
      return <ProductCarousel id={section.id} {...section.settings} />;
    case 'product-tabs':
      return (
        <BestSellers
          title={section.settings.title}
          subtitle={section.settings.subtitle}
          categorySlugs={section.settings.tabs.map((t) => t.categorySlug)}
          limit={section.settings.limit}
        />
      );
    case 'recently-viewed':
      // Returning visitors only — renders nothing (and takes no space) on a first visit.
      return (
        <Container>
          <RecentlyViewed minItems={section.settings.minItems} className="py-16" />
        </Container>
      );
    case 'sale-banner':
      return (
        <SaleBanner
          promotion={{
            ...section.settings,
            cta: { label: section.settings.cta.label, href: section.settings.cta.href as Route },
          }}
        />
      );
    case 'collection-grid':
      return (
        <ShopByOccasion
          title={section.settings.title}
          subtitle={section.settings.subtitle}
          occasions={pick(occasions, section.settings.collectionSlugs)}
        />
      );
    case 'shop-the-look':
      return (
        <ShopTheLook
          title={section.settings.title}
          subtitle={section.settings.subtitle}
          look={section.settings.look}
        />
      );
    case 'testimonials':
      return <Testimonials title={section.settings.title} limit={section.settings.limit} />;
    case 'brand-story':
      return <BrandStory {...section.settings} />;
    case 'instagram-gallery':
      return (
        <InstagramGallery
          title={section.settings.title}
          subtitle={section.settings.subtitle}
          feed={{
            handle: section.settings.handle,
            profileUrl: section.settings.profileUrl,
            posts: section.settings.posts,
          }}
        />
      );
  }
}

/** The home page as staff arranged it: each section in order, configured from the API. */
export function HomeSections({
  sections,
  settings,
}: {
  sections: readonly TypedSectionDto[];
  settings: StoreSettings;
}) {
  return sections.map((section) => (
    <Section key={section.id} section={section} settings={settings} />
  ));
}
