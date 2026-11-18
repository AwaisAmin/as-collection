import { env } from './env';

/** Single source of truth for brand-level constants. */
export const siteConfig = {
  name: 'AS Collection Hub',
  shortName: 'AS Collection',
  tagline: 'Shop Smart • Look Elegant',
  description:
    'AS Collection Hub — premium unstitched & stitched dresses and makeup for women in Pakistan. Shop smart, look elegant.',
  url: env.NEXT_PUBLIC_SITE_URL,
  locale: 'en_PK',
} as const;

export type SiteConfig = typeof siteConfig;
