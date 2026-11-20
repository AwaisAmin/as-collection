import { z } from 'zod';

import { clearableText, optionalPlainText, plainText } from '../../../common/text.js';
import { slugSchema } from '../catalog.schemas.js';

/** Paisa, up to Rs 1 000 000. */
const minor = z.number().int().min(0).max(100_000_000);
const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/, 'letters, digits, dot, dash or underscore (max 64)');

const barcodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{4,64}$/, 'letters, digits or dashes (4–64)');

export const productStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

const specificationSchema = z.object({
  label: plainText({ min: 1, max: 80 }),
  value: plainText({ min: 1, max: 300 }),
});

/**
 * A product-level attribute. SELECT: one `valueIds` entry; MULTI_SELECT: one or more;
 * TEXT / NUMBER / BOOLEAN: `text` / `number` / `boolean`. Checked against the attribute's type.
 */
const attributeInputSchema = z.object({
  attributeId: z.uuid(),
  valueIds: z.array(z.uuid()).max(50).optional(),
  text: optionalPlainText({ max: 500 }),
  number: z.number().min(-1e9).max(1e9).optional(),
  boolean: z.boolean().optional(),
});

const optionSchema = z.object({ attributeId: z.uuid(), valueId: z.uuid() });

export const inventoryInputSchema = z.object({
  onHand: z.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(100_000).default(3),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
});

const variantFields = {
  sku: skuSchema,
  title: clearableText({ max: 200 }),
  priceMinor: minor,
  compareAtPriceMinor: nullable(minor).optional(),
  costMinor: nullable(minor).optional(),
  barcode: nullable(barcodeSchema).optional(),
  weightGrams: nullable(z.number().int().min(1).max(1_000_000)).optional(),
  isActive: z.boolean().optional(),
  /** Option values that tell this variant apart (Size = M). One per attribute. */
  options: z.array(optionSchema).max(5).optional(),
};

const compareAtAbovePrice = (
  v: { priceMinor?: number; compareAtPriceMinor?: number | null | undefined },
  ctx: z.RefinementCtx,
) => {
  if (
    v.priceMinor !== undefined &&
    v.compareAtPriceMinor !== undefined &&
    v.compareAtPriceMinor !== null &&
    v.compareAtPriceMinor <= v.priceMinor
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['compareAtPriceMinor'],
      message: 'must be higher than the price (it is the "was" price)',
    });
  }
};

export const createVariantSchema = z
  .object({ ...variantFields, inventory: inventoryInputSchema.prefault({}) })
  .superRefine(compareAtAbovePrice);
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

/** Stock is changed through `/admin/inventory` (ledgered), never by editing the variant. */
export const updateVariantSchema = z
  .object({ ...variantFields, position: z.number().int().min(0).max(10_000) })
  .partial()
  .superRefine(compareAtAbovePrice);
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

const mediaInputSchema = z.object({
  mediaId: z.uuid(),
  /** Overrides the image's own alt text on this product. */
  alt: optionalPlainText({ max: 300 }),
  /** Pins the image to one variant (e.g. a shade), by SKU. */
  variantSku: skuSchema.optional(),
});
export type MediaInput = z.infer<typeof mediaInputSchema>;

const productFields = {
  name: plainText({ min: 2, max: 200 }),
  /** Generated from the name when omitted on create. */
  slug: slugSchema,
  shortDescription: clearableText({ max: 500 }),
  /** Markdown; rendered (and escaped) by the storefront. */
  description: clearableText({ max: 20_000, multiline: true }),
  status: z.enum(productStatuses),
  primaryCategoryId: z.uuid(),
  /** Extra categories (besides the primary one). */
  categoryIds: z.array(z.uuid()).max(20),
  brandId: nullable(z.uuid()),
  specifications: z.array(specificationSchema).max(40),
  sizeGuide: nullable(slugSchema.max(60)),
  isFeatured: z.boolean(),
  isBestseller: z.boolean(),
  seoTitle: clearableText({ max: 160 }),
  seoDescription: clearableText({ max: 320 }),
  /** Tag names; new tags are created. */
  tags: z.array(plainText({ min: 1, max: 80 })).max(30),
  attributes: z.array(attributeInputSchema).max(50),
  /** Gallery in display order. */
  media: z.array(mediaInputSchema).max(30),
};

const noDuplicates =
  <T>(key: (item: T) => string, label: string) =>
  (items: T[] | undefined, ctx: z.RefinementCtx) => {
    if (!items) return;
    const seen = new Set<string>();
    for (const item of items) {
      const k = key(item);
      if (seen.has(k)) ctx.addIssue({ code: 'custom', message: `duplicate ${label}: ${k}` });
      seen.add(k);
    }
  };

const productRefinements = (
  p: {
    attributes?: { attributeId: string }[] | undefined;
    media?: MediaInput[] | undefined;
    categoryIds?: string[] | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  noDuplicates<{ attributeId: string }>((a) => a.attributeId, 'attribute')(p.attributes, ctx);
  noDuplicates<MediaInput>((m) => m.mediaId, 'image')(p.media, ctx);
  noDuplicates<string>((id) => id, 'category')(p.categoryIds, ctx);
};

export const createProductSchema = z
  .object({
    ...productFields,
    slug: productFields.slug.optional(),
    status: productFields.status.default('DRAFT'),
    categoryIds: productFields.categoryIds.default([]),
    brandId: productFields.brandId.default(null),
    specifications: productFields.specifications.default([]),
    sizeGuide: productFields.sizeGuide.default(null),
    isFeatured: productFields.isFeatured.default(false),
    isBestseller: productFields.isBestseller.default(false),
    shortDescription: productFields.shortDescription.optional(),
    description: productFields.description.optional(),
    seoTitle: productFields.seoTitle.optional(),
    seoDescription: productFields.seoDescription.optional(),
    tags: productFields.tags.default([]),
    attributes: productFields.attributes.default([]),
    media: productFields.media.default([]),
    variants: z.array(createVariantSchema).min(1).max(100),
  })
  .superRefine((p, ctx) => {
    productRefinements(p, ctx);
    noDuplicates<{ sku: string }>((v) => v.sku, 'SKU')(p.variants, ctx);
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Partial update. List fields (categories, tags, attributes, media, specifications) replace the
 * whole list when present. `updatedAt` from the last read is required: if someone else saved in
 * between, the update is refused (409 STALE_UPDATE) instead of silently overwriting their work.
 */
export const updateProductSchema = z
  .object(productFields)
  .partial()
  .extend({ updatedAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)) })
  .superRefine(productRefinements);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true');

export const adminProductsQuerySchema = z.object({
  /** Name (fuzzy) or exact SKU. */
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(productStatuses).optional(),
  category: z.uuid().optional(),
  brand: z.uuid().optional(),
  lowStock: flag.optional(),
  sort: z.enum(['updated', 'newest', 'name', 'price']).default('updated'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminProductsQuery = z.infer<typeof adminProductsQuerySchema>;

export const inventoryReasons = ['RESTOCK', 'ADJUSTMENT', 'DAMAGE', 'RETURN'] as const;

/**
 * Stock changes, applied together or not at all: `add` (+/−) or `set` (a stock count). SALE
 * movements come only from shipping orders.
 */
export const adjustStockSchema = z.object({
  reason: z.enum(inventoryReasons),
  note: optionalPlainText({ max: 500 }),
  reference: optionalPlainText({ max: 100 }),
  items: z
    .array(
      z.union([
        z.object({ variantId: z.uuid(), add: z.number().int().min(-1_000_000).max(1_000_000) }),
        z.object({ variantId: z.uuid(), set: z.number().int().min(0).max(1_000_000) }),
      ]),
    )
    .min(1)
    .max(500)
    .superRefine(noDuplicates<{ variantId: string }>((i) => i.variantId, 'variant')),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const inventorySettingsSchema = inventoryInputSchema
  .omit({ onHand: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to change');

export const adminInventoryQuerySchema = z.object({
  /** SKU prefix or product name. */
  q: z.string().trim().min(1).max(100).optional(),
  stock: z.enum(['all', 'low', 'out', 'backorder']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AdminInventoryQuery = z.infer<typeof adminInventoryQuerySchema>;

export const movementsQuerySchema = z.object({
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
