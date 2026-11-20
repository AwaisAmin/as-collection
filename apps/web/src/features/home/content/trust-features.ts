import type { IconType } from 'react-icons';
import { FaGift, FaTruckFast } from 'react-icons/fa6';
import { PiHeadsetBold, PiShieldCheckBold } from 'react-icons/pi';

import { siteConfig } from '@/config/site';

export interface TrustFeature {
  id: string;
  icon: IconType;
  /** Two display lines. */
  lines: readonly [string, string];
  /** Optional link (e.g. tel: for the support number). */
  href?: string;
}

export const trustFeatures: readonly TrustFeature[] = [
  {
    id: 'shipping',
    icon: FaTruckFast,
    lines: ['Free Shipping', `on Orders Above ${siteConfig.freeShippingThreshold}`],
  },
  { id: 'cod', icon: PiShieldCheckBold, lines: ['Cash on Delivery', 'Available'] },
  {
    id: 'support',
    icon: PiHeadsetBold,
    lines: ['Customer Support', siteConfig.contact.phone],
    href: siteConfig.contact.phoneHref,
  },
  { id: 'returns', icon: FaGift, lines: ['Easy Returns', '& Exchange'] },
];

const ICONS: Record<string, IconType> = {
  shipping: FaTruckFast,
  cod: PiShieldCheckBold,
  support: PiHeadsetBold,
  returns: FaGift,
};

/** Store-setting trust items (id + two lines) → the bar's items; unknown ids get a gift icon. */
export const toTrustFeatures = (
  items: readonly { id: string; lines: readonly string[]; href?: string }[],
): TrustFeature[] =>
  items.map((item) => ({
    id: item.id,
    icon: ICONS[item.id] ?? FaGift,
    lines: [item.lines[0] ?? '', item.lines[1] ?? ''],
    ...(item.href ? { href: item.href } : {}),
  }));
