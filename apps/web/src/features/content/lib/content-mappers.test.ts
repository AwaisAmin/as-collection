import type { MenuDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import {
  defaultMenus,
  defaultSettings,
  toFooterNav,
  toShopMega,
  toStoreSettings,
} from './content-mappers';

const item = (
  label: string,
  url: string | null,
  kind?: 'category-column' | 'link-group',
  children: MenuDto['items'] = [],
) => ({
  id: label,
  label,
  url,
  openInNewTab: false,
  settings: kind ? { kind } : null,
  children,
});

describe('content mappers', () => {
  it('uses configured settings and falls back per key', () => {
    const settings = toStoreSettings({
      shipping: { flatFeeMinor: 30_000, freeShippingThresholdMinor: 400_000, returnWindowDays: 14 },
      'store.socials': [
        { platform: 'instagram', label: 'Instagram', href: 'https://instagram.com/x' },
        { platform: 'myspace', label: 'MySpace', href: 'https://myspace.com/x' },
      ],
      'payments.transfer-accounts': {
        isPlaceholder: false,
        transferAccounts: {
          jazzcash: {
            channel: 'jazzcash',
            label: 'JazzCash',
            fields: [{ label: 'Number', value: '0300-0000000' }],
          },
        },
      },
    });
    expect(settings.shipping).toEqual({
      shippingFee: 300,
      freeShippingThreshold: 4000,
      returnWindowDays: 14,
    });
    expect(settings.socials.map((s) => s.platform)).toEqual(['instagram']);
    expect(Object.keys(settings.transferAccounts)).toEqual(['jazzcash']);
    expect(settings.paymentsPlaceholder).toBe(false);
    expect(settings.contact).toEqual(defaultSettings.contact);
    expect(toStoreSettings(null)).toBe(defaultSettings);
  });

  it('builds the Shop mega menu from category columns and link groups', () => {
    const mega = toShopMega({
      key: 'shop-mega',
      name: 'Shop',
      items: [
        item('Makeup', '/shop/makeup', 'category-column', [
          item('Lipstick', '/shop/makeup?q=lipstick'),
        ]),
        item('Shop by occasion', '/shop', 'link-group', [item('Eid', '/shop?occasion=eid')]),
        item('Highlights', '/shop', 'link-group', [item('On Sale', '/shop?sale=1')]),
      ],
    });
    expect(mega).toEqual({
      columns: [
        {
          label: 'Makeup',
          href: '/shop/makeup',
          links: [{ label: 'Lipstick', href: '/shop/makeup?q=lipstick' }],
        },
      ],
      occasions: [{ label: 'Eid', href: '/shop?occasion=eid' }],
      highlights: [{ label: 'On Sale', href: '/shop?sale=1' }],
    });
    expect(toShopMega(null)).toBe(defaultMenus.shopMega);
    expect(toFooterNav({ key: 'footer', name: 'Footer', items: [] })).toBe(defaultMenus.footer);
  });
});
