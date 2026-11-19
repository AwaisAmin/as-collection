import type { Route } from 'next';

export const occasionSlugs = ['everyday', 'dawat', 'wedding', 'eid'] as const;
export type OccasionSlug = (typeof occasionSlugs)[number];

export interface Occasion {
  slug: OccasionSlug;
  name: string;
  /** One-line teaser on the home page card. */
  blurb: string;
  image: { src: string; alt: string };
}

/** Shop-by-occasion edits. Images live in /public/images/occasions (swap files, keep names). */
export const occasions: readonly Occasion[] = [
  {
    slug: 'everyday',
    name: 'Everyday',
    blurb: 'Breathable lawn & easy essentials',
    image: {
      src: '/images/occasions/everyday.jpg',
      alt: 'Folded lawn fabric with a woven gold border',
    },
  },
  {
    slug: 'dawat',
    name: 'Dawat',
    blurb: 'Dinner-ready formals that shine',
    image: {
      src: '/images/occasions/dawat.jpg',
      alt: 'Black chiffon outfit with gold embroidery on the sleeves',
    },
  },
  {
    slug: 'wedding',
    name: 'Wedding',
    blurb: 'Statement pieces for the big days',
    image: {
      src: '/images/occasions/wedding.jpg',
      alt: 'Maroon embroidered kurta with a gold-worked neckline',
    },
  },
  {
    slug: 'eid',
    name: 'Eid',
    blurb: 'Festive edits for Eid mornings',
    image: {
      src: '/images/occasions/eid.jpg',
      alt: 'Model in a black and gold embroidered outfit with gold earrings',
    },
  },
];

export const isOccasion = (value: string): value is OccasionSlug =>
  (occasionSlugs as readonly string[]).includes(value);

export const occasionName = (slug: OccasionSlug): string =>
  occasions.find((o) => o.slug === slug)?.name ?? slug;

export const occasionHref = (slug: OccasionSlug) => `/shop?occasion=${slug}` as Route;
