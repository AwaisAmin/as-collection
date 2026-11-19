import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

/*
 * Shape of the JSON snapshots in ./data (exported once from the storefront's mock catalog and
 * content config). Validated before seeding so a malformed snapshot fails loudly, not halfway.
 */

const image = z.object({ src: z.string().startsWith('/'), alt: z.string() });

const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  shortDescription: z.string(),
  description: z.array(z.string()),
  images: z.array(image).min(1),
  options: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.object({ value: z.string(), swatch: z.string().optional() })),
    }),
  ),
  variants: z
    .array(
      z.object({
        id: z.string(),
        sku: z.string(),
        options: z.record(z.string(), z.string()),
        price: z.number().int().nonnegative(),
        compareAtPrice: z.number().int().positive().optional(),
        stock: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  details: z.array(z.object({ label: z.string(), value: z.string() })),
  tags: z.array(z.string()),
  occasions: z.array(z.string()),
  sizeGuide: z.string().optional(),
  featured: z.boolean().optional(),
  bestseller: z.boolean().optional(),
  createdAt: z.iso.datetime(),
});

const catalogSchema = z.object({
  categories: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      image: z.string(),
      banner: z.object({
        eyebrow: z.string(),
        description: z.string(),
        image: image,
        focus: z.string().optional(),
      }),
    }),
  ),
  products: z.array(productSchema),
  reviews: z.array(
    z.object({
      productId: z.string(),
      author: z.string(),
      city: z.string().optional(),
      rating: z.number().int().min(1).max(5),
      title: z.string(),
      body: z.string(),
      createdAt: z.iso.datetime(),
      verifiedPurchase: z.boolean(),
      helpfulCount: z.number().int().nonnegative(),
    }),
  ),
});

const navLink = z.object({ label: z.string(), href: z.string() });

const contentSchema = z.object({
  occasions: z.array(
    z.object({ slug: z.string(), name: z.string(), blurb: z.string(), image: image }),
  ),
  promotion: z
    .object({
      id: z.string(),
      eyebrow: z.string(),
      title: z.string(),
      highlight: z.string(),
      description: z.string(),
      endsAt: z.iso.datetime({ offset: true }),
      cta: navLink,
      image: image,
    })
    .nullable(),
  look: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      image: image,
      hotspots: z.array(z.object({ productSlug: z.string(), x: z.number(), y: z.number() })),
    })
    .nullable(),
  instagram: z.object({
    handle: z.string(),
    profileUrl: z.url(),
    posts: z.array(z.object({ id: z.string(), image: image, href: z.string().optional() })),
  }),
  navigation: z.object({
    mainNav: z.array(navLink.extend({ children: z.array(navLink).optional() })),
    footerNav: z.array(navLink),
    shopMegaMenu: z.object({
      columns: z.array(navLink.extend({ links: z.array(navLink) })),
      occasions: z.array(navLink),
      highlights: z.array(navLink),
    }),
  }),
  site: z.looseObject({
    name: z.string(),
    shortName: z.string(),
    tagline: z.string(),
    description: z.string(),
    locale: z.string(),
    currency: z.string(),
    freeShippingThreshold: z.number(),
    shippingFee: z.number(),
    returnWindowDays: z.number(),
    contact: z.record(z.string(), z.unknown()),
  }),
  socials: z.array(z.object({ platform: z.string(), label: z.string(), href: z.url() })),
  payments: z.record(z.string(), z.unknown()),
  trustFeatures: z.array(z.looseObject({ id: z.string(), lines: z.array(z.string()) })),
});

export type CatalogSnapshot = z.infer<typeof catalogSchema>;
export type ProductSnapshot = z.infer<typeof productSchema>;
export type ContentSnapshot = z.infer<typeof contentSchema>;

function load<T>(schema: z.ZodType<T>, file: string): T {
  const raw: unknown = JSON.parse(readFileSync(join(import.meta.dirname, 'data', file), 'utf8'));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid seed snapshot ${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const loadCatalog = () => load(catalogSchema, 'catalog.json');
export const loadContent = () => load(contentSchema, 'content.json');
