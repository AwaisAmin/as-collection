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
}

export const categories: readonly Category[] = [
  {
    slug: 'unstitched',
    name: 'Unstitched Dresses',
    titleLines: ['Unstitched', 'Dresses'],
    href: '/shop/unstitched',
    image: 'unstitched',
  },
  {
    slug: 'stitched',
    name: 'Stitched Dresses',
    titleLines: ['Stitched', 'Dresses'],
    href: '/shop/stitched',
    image: 'stitched',
  },
  {
    slug: 'makeup',
    name: 'Makeup',
    titleLines: ['Makeup'],
    href: '/shop/makeup',
    image: 'makeup',
  },
];

export function isCategorySlug(value: string): value is CategorySlug {
  return (categorySlugs as readonly string[]).includes(value);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
