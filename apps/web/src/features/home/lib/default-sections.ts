import type { TypedSectionDto } from '@as/contracts';

import { categorySlugs } from '@/config/catalog';
import { instagram } from '@/config/instagram';
import { featuredLook } from '@/config/looks';
import { occasionSlugs } from '@/config/occasions';
import { activePromotion } from '@/config/promotions';

import { brandStory } from '../content/brand-story';

/**
 * The home page as designed, from the bundled config: shown whenever the store's home page is
 * missing or cannot be loaded.
 */
export const defaultHomeSections: readonly TypedSectionDto[] = [
  { id: 'hero', type: 'hero', settings: { variant: 'reference-design' }, endsAt: null },
  {
    id: 'categories',
    type: 'category-grid',
    settings: { categorySlugs: [...categorySlugs] },
    endsAt: null,
  },
  { id: 'trust', type: 'trust-bar', settings: { settingKey: 'home.trust-features' }, endsAt: null },
  {
    id: 'new-arrivals',
    type: 'product-carousel',
    settings: {
      title: 'New Arrivals',
      subtitle: 'Fresh lawn, festive formals and beauty picks — just landed.',
      source: { kind: 'newest' },
      limit: 8,
      cta: { label: 'View all new arrivals', href: '/shop?sort=newest' },
    },
    endsAt: null,
  },
  {
    id: 'best-sellers',
    type: 'product-tabs',
    settings: {
      title: 'Best Sellers',
      subtitle: 'The pieces our customers keep coming back for.',
      source: { kind: 'bestsellers' },
      tabs: categorySlugs.map((categorySlug) => ({ categorySlug })),
      limit: 4,
    },
    endsAt: null,
  },
  { id: 'recently-viewed', type: 'recently-viewed', settings: { minItems: 2 }, endsAt: null },
  ...(activePromotion
    ? [
        {
          id: 'sale',
          type: 'sale-banner' as const,
          settings: activePromotion,
          endsAt: activePromotion.endsAt,
        },
      ]
    : []),
  {
    id: 'occasions',
    type: 'collection-grid',
    settings: {
      title: 'Shop by Occasion',
      subtitle: 'From everyday lawn to wedding-season showstoppers.',
      collectionSlugs: [...occasionSlugs],
    },
    endsAt: null,
  },
  ...(featuredLook
    ? [
        {
          id: 'look',
          type: 'shop-the-look' as const,
          settings: {
            title: 'Shop the Look',
            subtitle: 'Tap the dots to see every piece in this look.',
            look: { ...featuredLook, hotspots: [...featuredLook.hotspots] },
          },
          endsAt: null,
        },
      ]
    : []),
  {
    id: 'testimonials',
    type: 'testimonials',
    settings: { title: 'Loved by Our Customers', limit: 8 },
    endsAt: null,
  },
  {
    id: 'story',
    type: 'brand-story',
    settings: {
      title: brandStory.title,
      script: brandStory.script,
      image: {
        src: '/images/brand/story.jpg',
        alt: 'Close-up of gold floral embroidery on black fabric',
      },
      cta: { label: 'Read our story', href: '/about' },
    },
    endsAt: null,
  },
  {
    id: 'instagram',
    type: 'instagram-gallery',
    settings: {
      title: 'Follow Us on Instagram',
      subtitle: 'New drops, styling ideas and behind-the-scenes — every week.',
      handle: instagram.handle,
      profileUrl: instagram.profileUrl,
      posts: [...instagram.posts],
    },
    endsAt: null,
  },
];
