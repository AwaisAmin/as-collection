import type { MenuDto, MenuItemDto, PublicSettingsDto } from '@as/contracts';
import type { Route } from 'next';

import { footerNav, mainNav, type NavItem, type NavLink, shopMegaMenu } from '@/config/navigation';
import { transferAccounts, transferChannels } from '@/config/payments';
import { siteConfig } from '@/config/site';
import { socialLinks, type SocialPlatform, socialPlatforms } from '@/config/socials';
import { toRupees } from '@/features/catalog/services/api-mappers';

import type { StoreMenus, StoreSettings } from '../types';

/*
 * API settings and menus → what the storefront renders. Any setting or menu the store has not
 * configured (or that fails to load) falls back to the bundled defaults, so the header, footer and
 * checkout always have something sensible. Pure, unit-tested.
 */

/** The bundled defaults (also the offline `MOCK_API` content). */
export const defaultSettings: StoreSettings = {
  profile: {
    name: siteConfig.name,
    shortName: siteConfig.shortName,
    tagline: siteConfig.tagline,
    description: siteConfig.description,
  },
  contact: siteConfig.contact,
  socials: socialLinks,
  shipping: {
    shippingFee: siteConfig.shippingFee,
    freeShippingThreshold: siteConfig.freeShippingThreshold,
    returnWindowDays: siteConfig.returnWindowDays,
  },
  transferAccounts,
  paymentsPlaceholder: true,
  announcements: [
    {
      id: 'shipping',
      icon: 'truck',
      text: `Free Shipping on Orders Above ${siteConfig.freeShippingThreshold}`,
    },
    { id: 'cod', icon: 'shield-check', text: 'Cash on Delivery Available' },
    {
      id: 'support',
      icon: 'headset',
      text: `Customer Support: ${siteConfig.contact.phone}`,
      href: siteConfig.contact.phoneHref,
    },
  ],
  trustFeatures: [
    {
      id: 'shipping',
      lines: ['Free Shipping', `on Orders Above ${siteConfig.freeShippingThreshold}`],
    },
    { id: 'cod', lines: ['Cash on Delivery', 'Available'] },
    {
      id: 'support',
      lines: ['Customer Support', siteConfig.contact.phone],
      href: siteConfig.contact.phoneHref,
    },
    { id: 'returns', lines: ['Easy Returns', '& Exchange'] },
  ],
};

export const defaultMenus: StoreMenus = {
  main: mainNav,
  shopMega: shopMegaMenu,
  footer: footerNav,
};

const isPlatform = (p: string): p is SocialPlatform =>
  (socialPlatforms as readonly string[]).includes(p);

export function toStoreSettings(dto: PublicSettingsDto | null): StoreSettings {
  if (!dto) return defaultSettings;
  const profile = dto['store.profile'];
  const shipping = dto.shipping;
  const payments = dto['payments.transfer-accounts'];
  const socials = dto['store.socials']?.flatMap((s) =>
    isPlatform(s.platform) ? [{ platform: s.platform, label: s.label, href: s.href }] : [],
  );
  return {
    profile: profile
      ? {
          name: profile.name,
          shortName: profile.shortName,
          tagline: profile.tagline,
          description: profile.description,
        }
      : defaultSettings.profile,
    contact: dto['store.contact'] ?? defaultSettings.contact,
    socials: socials ?? defaultSettings.socials,
    shipping: shipping
      ? {
          shippingFee: toRupees(shipping.flatFeeMinor),
          freeShippingThreshold: toRupees(shipping.freeShippingThresholdMinor),
          returnWindowDays: shipping.returnWindowDays,
        }
      : defaultSettings.shipping,
    transferAccounts: payments
      ? Object.fromEntries(
          transferChannels.flatMap((channel) => {
            const account = payments.transferAccounts[channel];
            return account ? [[channel, { ...account, channel }]] : [];
          }),
        )
      : defaultSettings.transferAccounts,
    paymentsPlaceholder: payments ? payments.isPlaceholder : defaultSettings.paymentsPlaceholder,
    announcements: dto.announcements ?? defaultSettings.announcements,
    trustFeatures: dto['home.trust-features'] ?? defaultSettings.trustFeatures,
  };
}

// ─── Menus ───

/** Menu URLs are validated by the API (paths, https, tel:, mailto:); typed routes for Link. */
const asRoute = (url: string | null): Route => (url ?? '/') as Route;

const toLink = (item: MenuItemDto): NavLink => ({ label: item.label, href: asRoute(item.url) });

export function toMainNav(menu: MenuDto | null): readonly NavItem[] {
  if (!menu?.items.length) return defaultMenus.main;
  return menu.items.map((item) => ({
    ...toLink(item),
    ...(item.children.length ? { children: item.children.map(toLink) } : {}),
  }));
}

export function toFooterNav(menu: MenuDto | null): readonly NavLink[] {
  return menu?.items.length ? menu.items.map(toLink) : defaultMenus.footer;
}

/**
 * The Shop mega menu: `category-column` items become columns (their children are the quick
 * links); the first two `link-group` items are "Shop by occasion" and "Highlights".
 */
export function toShopMega(menu: MenuDto | null): StoreMenus['shopMega'] {
  if (!menu?.items.length) return defaultMenus.shopMega;
  const columns = menu.items
    .filter((i) => i.settings?.kind === 'category-column')
    .map((i) => ({ ...toLink(i), links: i.children.map(toLink) }));
  const [occasions, highlights] = menu.items.filter((i) => i.settings?.kind === 'link-group');
  return {
    columns,
    occasions: occasions ? occasions.children.map(toLink) : [],
    highlights: highlights ? highlights.children.map(toLink) : [],
  };
}
