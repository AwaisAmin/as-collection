import type { Route } from 'next';

import type { ImageKey } from './assets';

export const categorySlugs = ['unstitched', 'stitched', 'makeup'] as const;
export type CategorySlug = (typeof categorySlugs)[number];

export interface Category {
  slug: CategorySlug;
  /** Full display name (menus, page titles). */
  name: string;
  /** Lines used for the stacked card title on the home page. */
  titleLines: readonly string[];
  href: Route;
  image: ImageKey;
  /** Category page hero. Images in /public/images/banners (swap files, keep names). */
  banner: {
    eyebrow: string;
    description: string;
    image: { src: string; alt: string };
    /** CSS object-position for the crop, e.g. "50% 30%". */
    focus?: string;
  };
}

export const categories: readonly Category[] = [
  {
    slug: 'unstitched',
    name: 'Unstitched Dresses',
    titleLines: ['Unstitched', 'Dresses'],
    href: '/shop/unstitched',
    image: 'unstitched',
    banner: {
      eyebrow: 'Fabric & embroidery',
      description:
        'Lawn, chiffon and organza suits with rich zari and tilla work — tailored your way.',
      image: {
        src: '/images/banners/unstitched.jpg',
        alt: 'Folded black and beige unstitched fabrics with gold embroidery',
      },
      focus: '50% 45%',
    },
  },
  {
    slug: 'stitched',
    name: 'Stitched Dresses',
    titleLines: ['Stitched', 'Dresses'],
    href: '/shop/stitched',
    image: 'stitched',
    banner: {
      eyebrow: 'Ready to wear',
      description: 'Kurtas, frocks and maxis in true-to-size fits, embroidered to impress.',
      image: {
        src: '/images/banners/stitched.jpg',
        alt: 'Maroon embroidered stitched kurta on a hanger',
      },
      focus: '50% 30%',
    },
  },
  {
    slug: 'makeup',
    name: 'Makeup',
    titleLines: ['Makeup'],
    href: '/shop/makeup',
    image: 'makeup',
    banner: {
      eyebrow: 'Beauty essentials',
      description: 'Long-wear makeup in shades made for Pakistani skin tones — everyday to bridal.',
      image: {
        src: '/images/banners/makeup.jpg',
        alt: 'Red lipstick, foundation, compact powder and a makeup brush on marble',
      },
      focus: '50% 60%',
    },
  },
];

export function isCategorySlug(value: string): value is CategorySlug {
  return (categorySlugs as readonly string[]).includes(value);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
