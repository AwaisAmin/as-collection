import type { Route } from 'next';

import type { ImageKey } from '@/config/assets';

/** Hero copy & media. Kept as data so it can later come from a CMS / the API. */
export interface HeroContent {
  title: string;
  taglineParts: readonly [string, string];
  script: string;
  cta: { label: string; href: Route };
  image: ImageKey;
}

export const heroContent: HeroContent = {
  title: 'AS Collection Hub',
  taglineParts: ['Shop Smart', 'Look Elegant'],
  script: 'Because You Deserve the Best',
  cta: { label: 'Shop Now', href: '/shop' },
  image: 'heroModel',
};
