import { Headset, type LucideIcon, ShieldCheck, Truck } from 'lucide-react';

import { siteConfig } from './site';

export interface Announcement {
  id: string;
  icon: LucideIcon;
  text: string;
  /** Optional link (e.g. tel: for the support number). */
  href?: string;
}

/** Items shown in the black top announcement bar. */
export const announcements: readonly Announcement[] = [
  {
    id: 'shipping',
    icon: Truck,
    text: `Free Shipping on Orders Above ${siteConfig.freeShippingThreshold}`,
  },
  { id: 'cod', icon: ShieldCheck, text: 'Cash on Delivery Available' },
  {
    id: 'support',
    icon: Headset,
    text: `Customer Support: ${siteConfig.contact.phone}`,
    href: siteConfig.contact.phoneHref,
  },
];
