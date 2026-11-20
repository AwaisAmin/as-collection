/* Storefront content: pages built from sections, navigation menus and public store settings. */

export interface SectionDto {
  id: string;
  /** hero, category-grid, product-carousel, sale-banner, … (see the API's SECTION_SCHEMAS). */
  type: string;
  /** Validated by the section type's schema; shape depends on `type`. */
  settings: unknown;
  /** Campaign end (ISO), so the storefront can hide the block at the exact moment. */
  endsAt: string | null;
}

/** `GET /content/pages/:slug`: a published page with its live sections, in order. */
export interface PageDto {
  slug: string;
  title: string;
  seo: { title: string | null; description: string | null };
  sections: SectionDto[];
}

export interface MenuItemSettingsDto {
  kind?: 'category-column' | 'link-group' | 'feature-card';
  source?: 'active-promotion';
  fallback?: 'new-arrivals';
  badge?: string;
}

export interface MenuItemDto {
  id: string;
  label: string;
  /** Site path, https URL, tel: or mailto: (validated by the API). */
  url: string | null;
  openInNewTab: boolean;
  settings: MenuItemSettingsDto | null;
  children: MenuItemDto[];
}

/** `GET /content/menus/:key` ("main", "shop-mega", "footer"): visible items only. */
export interface MenuDto {
  key: string;
  name: string;
  items: MenuItemDto[];
}

export type AnnouncementIcon = 'truck' | 'shield-check' | 'headset' | 'gift' | 'sparkles' | 'tag';
export type TransferChannelKey = 'bank' | 'jazzcash' | 'easypaisa';

/** `GET /content/settings`: every public setting that is configured (each key optional). */
export interface PublicSettingsDto {
  'store.profile'?: {
    name: string;
    shortName: string;
    tagline: string;
    description: string;
    locale: string;
    currency: 'PKR';
  };
  'store.contact'?: {
    phone: string;
    phoneE164: string;
    phoneHref: string;
    whatsappHref: string;
    hours: string;
    email: string;
    emailHref: string;
  };
  'store.socials'?: { platform: string; label: string; href: string }[];
  shipping?: { flatFeeMinor: number; freeShippingThresholdMinor: number; returnWindowDays: number };
  'payments.transfer-accounts'?: {
    /** True until the owner enters real account details. */
    isPlaceholder: boolean;
    transferAccounts: Partial<
      Record<
        TransferChannelKey,
        {
          channel: TransferChannelKey;
          label: string;
          fields: { label: string; value: string }[];
        }
      >
    >;
  };
  'home.trust-features'?: { id: string; lines: string[]; href?: string }[];
  announcements?: { id: string; icon: AnnouncementIcon; text: string; href?: string }[];
}
