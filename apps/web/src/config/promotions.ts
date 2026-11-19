import type { Route } from 'next';

export interface Promotion {
  id: string;
  eyebrow: string;
  title: string;
  /** Script-font highlight under the title. */
  highlight: string;
  description: string;
  /** ISO date with offset — the countdown target. The banner hides itself once it passes. */
  endsAt: string;
  cta: { label: string; href: Route };
  image: { src: string; alt: string };
}

/**
 * The home page campaign banner (`null` hides it). Edited here until the admin panel
 * manages campaigns; the image lives in /public/images/promo (swap the file, keep the name).
 */
export const activePromotion: Promotion | null = {
  id: 'festive-2026',
  eyebrow: 'Limited time',
  title: 'Festive Sale',
  highlight: 'Up to 20% off',
  description:
    'Embroidered lawn, chiffon formals and beauty essentials at special prices — while stock lasts.',
  endsAt: '2026-12-31T23:59:59+05:00',
  cta: { label: 'Shop the sale', href: '/shop?sale=1' as Route },
  image: {
    src: '/images/promo/festive-sale.jpg',
    alt: 'Model wearing gold jhumka earrings and a black embroidered outfit',
  },
};
