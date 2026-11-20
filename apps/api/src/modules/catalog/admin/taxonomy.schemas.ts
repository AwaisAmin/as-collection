import { z } from 'zod';

import { clearableText, plainText } from '../../../common/text.js';
import { slugSchema } from '../catalog.schemas.js';
import { collectionRulesSchema } from '../product-query.js';

const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
const position = z.number().int().min(0).max(100_000);
const updatedAt = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
const seo = {
  seoTitle: clearableText({ max: 160 }),
  seoDescription: clearableText({ max: 320 }),
};

/** Every list endpoint below returns everything (catalog taxonomies stay small). */

// ─── Categories ───

/** CSS object-position for the banner image, e.g. "50% 30%". */
const focusSchema = z.string().regex(/^(100|[1-9]?\d)% (100|[1-9]?\d)%$/, 'e.g. "50% 30%"');

export const categoryBannerSchema = z.object({
  eyebrow: clearableText({ max: 80 }),
  description: clearableText({ max: 400 }),
  focus: nullable(focusSchema).optional(),
});

const categoryFields = {
  name: plainText({ min: 1, max: 120 }),
  slug: slugSchema.max(120),
  parentId: nullable(z.uuid()),
  description: clearableText({ max: 2_000, multiline: true }),
  isActive: z.boolean(),
  imageId: nullable(z.uuid()),
  bannerImageId: nullable(z.uuid()),
  banner: nullable(categoryBannerSchema),
  ...seo,
  /** Filters shown on the category page (inherited by subcategories). */
  attributes: z
    .array(z.object({ attributeId: z.uuid(), isRequired: z.boolean().default(false) }))
    .max(30)
    .refine((list) => new Set(list.map((a) => a.attributeId)).size === list.length, {
      message: 'each attribute once',
    }),
};

export const createCategorySchema = z.object({
  ...categoryFields,
  slug: categoryFields.slug.optional(),
  parentId: categoryFields.parentId.default(null),
  isActive: categoryFields.isActive.default(true),
  imageId: categoryFields.imageId.default(null),
  bannerImageId: categoryFields.bannerImageId.default(null),
  banner: categoryFields.banner.default(null),
  attributes: categoryFields.attributes.default([]),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** `parentId` moves the category (and its subtree). */
export const updateCategorySchema = z.object(categoryFields).partial().extend({ updatedAt });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/** New order of one parent's children (all of them). */
export const reorderSchema = z.object({
  parentId: nullable(z.uuid()).default(null),
  ids: z.array(z.uuid()).min(1).max(500),
});

// ─── Attributes ───

export const attributeTypes = ['SELECT', 'MULTI_SELECT', 'TEXT', 'NUMBER', 'BOOLEAN'] as const;
export const attributeScopes = ['PRODUCT', 'VARIANT'] as const;

/** Swatch colour: #RGB or #RRGGBB. */
const swatchSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'a hex colour like #8b1a1a')
  .transform((v) => v.toLowerCase());

export const attributeValueSchema = z.object({
  /** URL value (`?f.fabric=lawn`); generated from the label when omitted. Cannot change later. */
  value: slugSchema.max(80).optional(),
  label: plainText({ min: 1, max: 120 }),
  swatch: nullable(swatchSchema).optional(),
  position: position.optional(),
});
export type AttributeValueInput = z.infer<typeof attributeValueSchema>;

export const updateAttributeValueSchema = z
  .object({
    label: plainText({ min: 1, max: 120 }),
    swatch: nullable(swatchSchema),
    position,
  })
  .partial();

const choiceTypes: readonly string[] = ['SELECT', 'MULTI_SELECT'];

export const createAttributeSchema = z
  .object({
    /** Filter parameter name (`f.<code>`); generated from the name when omitted. Cannot change. */
    code: slugSchema.max(60).optional(),
    name: plainText({ min: 1, max: 80 }),
    type: z.enum(attributeTypes),
    scope: z.enum(attributeScopes).default('PRODUCT'),
    isFilterable: z.boolean().default(true),
    isVisible: z.boolean().default(true),
    unit: clearableText({ max: 20 }),
    position: position.optional(),
    values: z.array(attributeValueSchema).max(200).default([]),
  })
  .superRefine((a, ctx) => {
    if (a.scope === 'VARIANT' && a.type !== 'SELECT') {
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'Variant options (Size, Shade…) must be single-choice (SELECT).',
      });
    }
    if (!choiceTypes.includes(a.type) && a.values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['values'],
        message: `${a.type} attributes have no value list.`,
      });
    }
  });
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;

/** Type and scope can change only while the attribute is unused. */
export const updateAttributeSchema = z
  .object({
    name: plainText({ min: 1, max: 80 }),
    type: z.enum(attributeTypes),
    scope: z.enum(attributeScopes),
    isFilterable: z.boolean(),
    isVisible: z.boolean(),
    unit: clearableText({ max: 20 }),
    position,
  })
  .partial()
  .extend({ updatedAt });
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;

// ─── Brands ───

const brandFields = {
  name: plainText({ min: 1, max: 120 }),
  slug: slugSchema.max(120),
  description: clearableText({ max: 2_000, multiline: true }),
  logoId: nullable(z.uuid()),
  isActive: z.boolean(),
};
export const createBrandSchema = z.object({
  ...brandFields,
  slug: brandFields.slug.optional(),
  logoId: brandFields.logoId.default(null),
  isActive: brandFields.isActive.default(true),
});
export const updateBrandSchema = z.object(brandFields).partial().extend({ updatedAt });

// ─── Collections ───

/**
 * Rules as the storefront evaluates them, plus admin limits: slugs only, at most 20 rules.
 * Attribute codes / values and tags are checked against the catalog by the service.
 */
export const adminCollectionRulesSchema = collectionRulesSchema.superRefine((rules, ctx) => {
  const list = 'all' in rules ? rules.all : rules.any;
  if (list.length > 20) ctx.addIssue({ code: 'custom', message: 'At most 20 rules.' });
  list.forEach((rule, i) => {
    const slugs = rule.field === 'tag' || rule.field === 'attribute' ? rule.value : [];
    const codes = rule.field === 'attribute' ? [rule.code] : [];
    for (const s of [...slugs, ...codes]) {
      if (!slugSchema.safeParse(s).success) {
        ctx.addIssue({ code: 'custom', path: ['rules', i], message: `"${s}" is not a slug.` });
      }
    }
    if (rule.field === 'priceMinor' && (rule.value < 0 || rule.value > 100_000_000)) {
      ctx.addIssue({ code: 'custom', path: ['rules', i, 'value'], message: 'Out of range.' });
    }
  });
});

const collectionFields = {
  name: plainText({ min: 1, max: 120 }),
  slug: slugSchema.max(120),
  description: clearableText({ max: 2_000, multiline: true }),
  type: z.enum(['MANUAL', 'AUTOMATED']),
  rules: nullable(adminCollectionRulesSchema),
  imageId: nullable(z.uuid()),
  isActive: z.boolean(),
  position,
  startsAt: nullable(z.iso.datetime({ offset: true }).transform((v) => new Date(v))),
  endsAt: nullable(z.iso.datetime({ offset: true }).transform((v) => new Date(v))),
  ...seo,
};

const windowAndRules = (
  c: {
    type?: 'MANUAL' | 'AUTOMATED' | undefined;
    rules?: unknown;
    startsAt?: Date | null | undefined;
    endsAt?: Date | null | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'must be after the start' });
  }
  if (c.type === 'AUTOMATED' && c.rules === null) {
    ctx.addIssue({ code: 'custom', path: ['rules'], message: 'Automated collections need rules.' });
  }
};

export const createCollectionSchema = z
  .object({
    ...collectionFields,
    slug: collectionFields.slug.optional(),
    type: collectionFields.type.default('MANUAL'),
    rules: collectionFields.rules.default(null),
    imageId: collectionFields.imageId.default(null),
    isActive: collectionFields.isActive.default(true),
    position: collectionFields.position.optional(),
    startsAt: collectionFields.startsAt.default(null),
    endsAt: collectionFields.endsAt.default(null),
  })
  .superRefine(windowAndRules);
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z
  .object(collectionFields)
  .partial()
  .extend({ updatedAt })
  .superRefine(windowAndRules);
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

/** Hand-picked products, in display order (replaces the list). */
export const collectionProductsSchema = z.object({
  productIds: z
    .array(z.uuid())
    .max(2_000)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'each product once' }),
});
