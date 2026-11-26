import type { Route } from 'next';

import { images } from './assets';

/*
 * Categories are managed in the admin and loaded from the API (features/catalog/services/
 * categories.ts). The three below are the built-in defaults: used while the API is unreachable,
 * and as the source of the photos and copy for these departments when the admin left them empty.
 */

/** The built-in departments (any admin-created slug is valid too). */
export const categorySlugs = ['unstitched', 'stitched', 'makeup'] as const;
export type CategorySlug = string;

/** A category slug as the admin writes it (lowercase words joined by dashes). */
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface Category {
  slug: CategorySlug;
  /** Full display name (menus, page titles). */
  name: string;
  /** Lines used for the stacked card title on the home page. */
  titleLines: readonly string[];
  href: Route;
  /** Card photo. */
  image: { src: string; alt: string };
  /** Category page hero. */
  banner: {
    eyebrow: string;
    description: string;
    image: { src: string; alt: string };
    /** CSS object-position for the crop, e.g. "50% 30%". */
    focus?: string;
  };
}

/** Built-in defaults (see above). */
export const categories: readonly Category[] = [
  {
    slug: 'unstitched',
    name: 'Unstitched Dresses',
    titleLines: ['Unstitched', 'Dresses'],
    href: '/shop/unstitched',
    image: images.unstitched,
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
    image: images.stitched,
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
    image: images.makeup,
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

export function isCategorySlug(value: string): boolean {
  return CATEGORY_SLUG_PATTERN.test(value) && value.length <= 120;
}

/** A built-in default category by slug. */
export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

/** "Bridal Wear Collection" → ["Bridal Wear", "Collection"] for the stacked card title. */
export function titleLinesFor(name: string): readonly string[] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name.trim()];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}
