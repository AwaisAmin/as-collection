import { z } from 'zod';

/*
 * Schemas for admin-managed content. Reads parse stored JSON through these (unknown keys are
 * stripped, so nothing private leaks and malformed rows are skipped instead of breaking the
 * storefront); admin writes (B7) validate with the same schemas.
 */

/**
 * Link target: a site path (`/shop?sale=1`), an https URL, or tel:/mailto:. Never
 * `javascript:`, `data:` or protocol-relative `//host` (open redirect / XSS via admin content).
 */
export const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) =>
      /^\/(?![/\\])[^\s]*$/.test(v) ||
      /^https:\/\/[^\s/]+[^\s]*$/i.test(v) ||
      /^tel:\+?[0-9-]{6,20}$/.test(v) ||
      /^mailto:[^\s@]+@[^\s@]+$/.test(v),
    'Use a site path (/shop), an https:// URL, tel: or mailto:.',
  );

/** Images on content blocks: site-relative or https (media library URLs). */
export const imageSchema = z.object({
  src: z
    .string()
    .max(1024)
    .refine((v) => /^\/(?![/\\])/.test(v) || /^https:\/\//i.test(v), 'Invalid image URL.'),
  alt: z.string().max(200),
});

export const linkSchema = z.object({ label: z.string().min(1).max(80), href: hrefSchema });

const slugList = (max: number) =>
  z
    .array(
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(120),
    )
    .max(max);

const heading = { title: z.string().min(1).max(120), subtitle: z.string().max(300).optional() };

const productSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('newest') }),
  z.object({ kind: z.literal('bestsellers') }),
  z.object({ kind: z.literal('on-sale') }),
  z.object({ kind: z.literal('top-rated') }),
  z.object({ kind: z.literal('collection'), slug: z.string().max(120) }),
  z.object({ kind: z.literal('category'), slug: z.string().max(120) }),
]);

export const promotionSchema = z.object({
  id: z.string().min(1).max(60),
  eyebrow: z.string().max(60),
  title: z.string().min(1).max(120),
  highlight: z.string().max(120),
  description: z.string().max(400),
  endsAt: z.iso.datetime({ offset: true }),
  cta: linkSchema,
  image: imageSchema,
});

/** Section type → settings schema. Unknown types are skipped (the storefront cannot render them). */
export const SECTION_SCHEMAS = {
  hero: z.object({ variant: z.string().max(60) }),
  'category-grid': z.object({ categorySlugs: slugList(24) }),
  'trust-bar': z.object({ settingKey: z.literal('home.trust-features') }),
  'product-carousel': z.object({
    ...heading,
    source: productSource,
    limit: z.int().min(1).max(24),
    cta: linkSchema.optional(),
  }),
  'product-tabs': z.object({
    ...heading,
    source: productSource,
    tabs: z
      .array(z.object({ categorySlug: z.string().max(120) }))
      .min(1)
      .max(8),
    limit: z.int().min(1).max(24),
  }),
  'recently-viewed': z.object({ minItems: z.int().min(1).max(12) }),
  'sale-banner': promotionSchema,
  'collection-grid': z.object({ ...heading, collectionSlugs: slugList(24) }),
  'shop-the-look': z.object({
    ...heading,
    look: z.object({
      id: z.string().max(60),
      title: z.string().max(120),
      description: z.string().max(400),
      image: imageSchema,
      hotspots: z
        .array(
          z.object({
            productSlug: z.string().max(120),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          }),
        )
        .max(12),
    }),
  }),
  testimonials: z.object({ title: z.string().min(1).max(120), limit: z.int().min(1).max(12) }),
  'brand-story': z.object({
    title: z.string().min(1).max(120),
    script: z.string().max(120),
    image: imageSchema,
    cta: linkSchema,
  }),
  'instagram-gallery': z.object({
    ...heading,
    handle: z.string().max(60),
    profileUrl: hrefSchema,
    posts: z
      .array(z.object({ id: z.string().max(60), image: imageSchema, href: hrefSchema.optional() }))
      .max(24),
  }),
} as const satisfies Record<string, z.ZodType>;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export const isSectionType = (type: string): type is SectionType =>
  Object.hasOwn(SECTION_SCHEMAS, type);

// ─── Public settings ───

const trustFeature = z.object({
  id: z.string().max(40),
  lines: z.array(z.string().max(80)).min(1).max(3),
  href: hrefSchema.optional(),
});

/** Icons the storefront maps to its icon set. */
export const announcementIcons = [
  'truck',
  'shield-check',
  'headset',
  'gift',
  'sparkles',
  'tag',
] as const;

/**
 * Settings the storefront may read, with exactly the fields it may see. Anything not listed
 * here (staff notes, provider credentials, internal flags) is never served.
 */
export const PUBLIC_SETTINGS = {
  'store.profile': z.object({
    name: z.string().max(120),
    shortName: z.string().max(60),
    tagline: z.string().max(160),
    description: z.string().max(400),
    locale: z.string().max(10),
    currency: z.literal('PKR'),
  }),
  'store.contact': z.object({
    phone: z.string().max(30),
    phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
    phoneHref: hrefSchema,
    whatsappHref: hrefSchema,
    hours: z.string().max(120),
    email: z.email(),
    emailHref: hrefSchema,
  }),
  'store.socials': z
    .array(z.object({ platform: z.string().max(30), label: z.string().max(60), href: hrefSchema }))
    .max(12),
  shipping: z.object({
    flatFeeMinor: z.int().min(0),
    freeShippingThresholdMinor: z.int().min(0),
    returnWindowDays: z.int().min(0).max(90),
  }),
  'payments.transfer-accounts': z.object({
    /** True until the owner enters real account details. */
    isPlaceholder: z.boolean().default(false),
    transferAccounts: z.partialRecord(
      z.enum(['bank', 'jazzcash', 'easypaisa']),
      z.object({
        channel: z.enum(['bank', 'jazzcash', 'easypaisa']),
        label: z.string().max(60),
        fields: z.array(z.object({ label: z.string().max(60), value: z.string().max(80) })).max(8),
      }),
    ),
  }),
  'home.trust-features': z.array(trustFeature).max(8),
  announcements: z
    .array(
      z.object({
        id: z.string().max(40),
        icon: z.enum(announcementIcons),
        text: z.string().min(1).max(120),
        href: hrefSchema.optional(),
      }),
    )
    .max(6),
} as const satisfies Record<string, z.ZodType>;

export type PublicSettingKey = keyof typeof PUBLIC_SETTINGS;
export const isPublicSettingKey = (key: string): key is PublicSettingKey =>
  Object.hasOwn(PUBLIC_SETTINGS, key);

// ─── Menus ───

export const menuItemSettingsSchema = z.object({
  kind: z.enum(['category-column', 'link-group', 'feature-card']).optional(),
  source: z.enum(['active-promotion']).optional(),
  fallback: z.enum(['new-arrivals']).optional(),
  badge: z.string().max(20).optional(),
});

export const menuKeySchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);
