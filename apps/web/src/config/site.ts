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
  currency: 'PKR',
  freeShippingThreshold: 2500,
  /** Flat delivery fee (PKR) below the free-shipping threshold. */
  shippingFee: 250,
  returnWindowDays: 7,
  contact: {
    phone: '0328-9485741',
    /** E.164 for tel: links and structured data. */
    phoneE164: '+923289485741',
    phoneHref: 'tel:+923289485741',
    email: 'collectionhubas@gmail.com',
    emailHref: 'mailto:collectionhubas@gmail.com',
  },
  copyrightYear: 2025,
} as const;

export type SiteConfig = typeof siteConfig;
