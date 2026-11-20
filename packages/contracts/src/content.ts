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

// ─── Page sections (settings per `type`, as the API validates them) ───

export interface ContentImage {
  src: string;
  alt: string;
}

export interface ContentLink {
  label: string;
  href: string;
}

interface SectionHeading {
  title: string;
  subtitle?: string;
}

export type ProductSource =
  | { kind: 'newest' }
  | { kind: 'bestsellers' }
  | { kind: 'on-sale' }
  | { kind: 'top-rated' }
  | { kind: 'collection'; slug: string }
  | { kind: 'category'; slug: string };

/** Campaign banner (`sale-banner` section; also `GET /content/promotions/active`). */
export interface PromotionDto {
  id: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  /** ISO with offset: countdown target; the banner hides itself once it passes. */
  endsAt: string;
  cta: ContentLink;
  image: ContentImage;
}

export interface SectionSettingsMap {
  hero: { variant: string };
  'category-grid': { categorySlugs: string[] };
  'trust-bar': { settingKey: 'home.trust-features' };
  'product-carousel': SectionHeading & { source: ProductSource; limit: number; cta?: ContentLink };
  'product-tabs': SectionHeading & {
    source: ProductSource;
    tabs: { categorySlug: string }[];
    limit: number;
  };
  'recently-viewed': { minItems: number };
  'sale-banner': PromotionDto;
  'collection-grid': SectionHeading & { collectionSlugs: string[] };
  'shop-the-look': SectionHeading & {
    look: {
      id: string;
      title: string;
      description: string;
      image: ContentImage;
      hotspots: { productSlug: string; x: number; y: number }[];
    };
  };
  testimonials: { title: string; limit: number };
  'brand-story': { title: string; script: string; image: ContentImage; cta: ContentLink };
  'instagram-gallery': SectionHeading & {
    handle: string;
    profileUrl: string;
    posts: { id: string; image: ContentImage; href?: string }[];
  };
}

export type SectionType = keyof SectionSettingsMap;

/** A section whose settings are typed by its `type`. */
export type TypedSectionDto = {
  [K in SectionType]: {
    id: string;
    type: K;
    settings: SectionSettingsMap[K];
    endsAt: string | null;
  };
}[SectionType];
