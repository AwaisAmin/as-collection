import { Gem, HandHeart, type LucideIcon, ShieldCheck, Truck } from 'lucide-react';

import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/utils/format';

/** Brand story copy — shared by the home strip and the About page so they never drift apart. */
export const brandStory = {
  title: 'Our Story',
  script: 'Because You Deserve the Best',
  intro: `${siteConfig.name} began with a simple idea: every woman deserves to feel elegant without compromise. We bring together beautifully embroidered unstitched and stitched dresses and premium makeup — curated with love, priced fairly, and delivered with care across Pakistan.`,
} as const;

export interface BrandValue {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const brandValues: readonly BrandValue[] = [
  {
    icon: Gem,
    title: 'Curated quality',
    text: 'Every suit is chosen for fabric, finish and embroidery — nothing that we wouldn’t wear ourselves.',
  },
  {
    icon: HandHeart,
    title: 'Made for you',
    text: 'From everyday lawn to festive chiffon, pieces for dawats, weddings, Eid and every day in between.',
  },
  {
    icon: ShieldCheck,
    title: 'Shop with confidence',
    text: `Cash on Delivery nationwide and easy ${siteConfig.returnWindowDays}-day returns & exchange.`,
  },
  {
    icon: Truck,
    title: 'Delivered to your door',
    text: `Carefully packed and delivered across Pakistan — free on orders above ${formatPrice(siteConfig.freeShippingThreshold)}.`,
  },
];
