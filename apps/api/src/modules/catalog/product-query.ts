import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ProductListQuery, ProductSort } from './catalog.schemas.js';

/*
 * Pure translation of a catalog query into Prisma `where` / `orderBy`. No I/O, so every rule is
 * unit-tested. The listing summary columns (price_min_minor, in_stock, is_on_sale,
 * rating_average) are maintained by database triggers, so filters and sorts never aggregate.
 */

export interface AttributeRef {
  id: string;
  scope: 'PRODUCT' | 'VARIANT';
}

export interface ProductQueryContext {
  /** Materialized path of the selected category (its subtree = paths starting with it). */
  categoryPath?: string;
  /** Attribute code → id/scope, for `f.<code>` filters. Unknown codes are ignored. */
  attributes: ReadonlyMap<string, AttributeRef>;
  /** Resolved `collection=` filters (manual membership or automated rules). */
  collections: readonly ResolvedCollection[];
  /** `prisma.inventoryItem.fields.reserved` — compares on_hand with reserved in SQL. */
  reservedField: Prisma.IntFieldRefInput<'InventoryItem'>;
  now: Date;
}

export type ResolvedCollection =
  { type: 'MANUAL'; id: string } | { type: 'AUTOMATED'; rules: CollectionRules };

/** Products a shopper may see: active and published. */
export const visibleProduct = (now: Date): Prisma.ProductWhereInput => ({
  status: 'ACTIVE',
  publishedAt: { lte: now },
});

/** Variant can be bought now. */
export const availableVariant = (
  reservedField: Prisma.IntFieldRefInput<'InventoryItem'>,
): Prisma.ProductVariantWhereInput => ({
  isActive: true,
  inventory: {
    is: {
      OR: [{ trackInventory: false }, { allowBackorder: true }, { onHand: { gt: reservedField } }],
    },
  },
});

/** Each search word must match the name, short description, a tag, the category or a collection. */
export function searchWhere(q: string): Prisma.ProductWhereInput[] {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_\\]/g, '')) // never let users inject LIKE wildcards
    .filter(Boolean)
    .slice(0, 8);
  return words.map((word) => ({
    OR: [
      { name: { contains: word, mode: 'insensitive' } },
      { shortDescription: { contains: word, mode: 'insensitive' } },
      { tags: { some: { tag: { slug: { contains: word } } } } },
      { primaryCategory: { name: { contains: word, mode: 'insensitive' } } },
      { collections: { some: { collection: { slug: { contains: word } } } } },
    ],
  }));
}

export const categoryWhere = (path: string): Prisma.ProductWhereInput => ({
  OR: [
    { primaryCategory: { path: { startsWith: path } } },
    { categories: { some: { category: { path: { startsWith: path } } } } },
  ],
});

// ─── Automated collection rules ───

const ruleSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('onSale'), op: z.literal('eq'), value: z.boolean() }),
  z.object({ field: z.literal('inStock'), op: z.literal('eq'), value: z.boolean() }),
  z.object({ field: z.literal('featured'), op: z.literal('eq'), value: z.boolean() }),
  z.object({ field: z.literal('tag'), op: z.literal('in'), value: z.array(z.string()).min(1) }),
  z.object({
    field: z.literal('attribute'),
    op: z.literal('in'),
    code: z.string(),
    value: z.array(z.string()).min(1),
  }),
  z.object({ field: z.literal('priceMinor'), op: z.enum(['lte', 'gte']), value: z.number().int() }),
  z.object({
    field: z.literal('publishedWithinDays'),
    op: z.literal('lte'),
    value: z.number().int().positive(),
  }),
]);

/** `{ all: [...] }` (every rule) or `{ any: [...] }` (at least one). Stored in `collections.rules`. */
export const collectionRulesSchema = z.union([
  z.object({ all: z.array(ruleSchema).min(1) }),
  z.object({ any: z.array(ruleSchema).min(1) }),
]);
export type CollectionRules = z.infer<typeof collectionRulesSchema>;

export function rulesWhere(
  rules: CollectionRules,
  ctx: Pick<ProductQueryContext, 'now'>,
): Prisma.ProductWhereInput {
  const list = 'all' in rules ? rules.all : rules.any;
  const conditions = list.map((rule): Prisma.ProductWhereInput => {
    switch (rule.field) {
      case 'onSale':
        return { isOnSale: rule.value };
      case 'inStock':
        return { inStock: rule.value };
      case 'featured':
        return { isFeatured: rule.value };
      case 'tag':
        return { tags: { some: { tag: { slug: { in: rule.value } } } } };
      case 'attribute':
        return {
          attributes: {
            some: { attribute: { code: rule.code }, value: { value: { in: rule.value } } },
          },
        };
      case 'priceMinor':
        return { priceMinMinor: { [rule.op]: rule.value } };
      case 'publishedWithinDays':
        return { publishedAt: { gte: new Date(ctx.now.getTime() - rule.value * 86_400_000) } };
    }
  });
  return 'all' in rules ? { AND: conditions } : { OR: conditions };
}

// ─── Listing ───

export function productWhere(
  query: Pick<ProductListQuery, 'q' | 'attributes' | 'tags' | 'min' | 'max' | 'inStock' | 'sale'>,
  ctx: ProductQueryContext,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [visibleProduct(ctx.now)];

  if (ctx.categoryPath) and.push(categoryWhere(ctx.categoryPath));
  if (query.q) and.push(...searchWhere(query.q));
  if (query.min !== undefined) and.push({ priceMinMinor: { gte: query.min } });
  if (query.max !== undefined) and.push({ priceMinMinor: { lte: query.max } });
  if (query.inStock) and.push({ inStock: true });
  if (query.sale) and.push({ isOnSale: true });
  if (query.tags.length) and.push({ tags: { some: { tag: { slug: { in: query.tags } } } } });

  if (ctx.collections.length) {
    and.push({
      OR: ctx.collections.map((c) =>
        c.type === 'MANUAL'
          ? { collections: { some: { collectionId: c.id } } }
          : rulesWhere(c.rules, ctx),
      ),
    });
  }

  for (const [code, values] of Object.entries(query.attributes)) {
    const attribute = ctx.attributes.get(code);
    if (!attribute) continue;
    if (attribute.scope === 'PRODUCT') {
      and.push({
        attributes: { some: { attributeId: attribute.id, value: { value: { in: values } } } },
      });
    } else {
      // Variant options (size, shade): only count a match if that variant can be bought now.
      and.push({
        variants: {
          some: {
            ...availableVariant(ctx.reservedField),
            options: { some: { attributeId: attribute.id, value: { value: { in: values } } } },
          },
        },
      });
    }
  }

  return { AND: and };
}

const byNewest: Prisma.ProductOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
];

export function productOrderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return byNewest;
    case 'price-asc':
      return [{ priceMinMinor: { sort: 'asc', nulls: 'last' } }, ...byNewest];
    case 'price-desc':
      return [{ priceMinMinor: { sort: 'desc', nulls: 'last' } }, ...byNewest];
    case 'rating':
      return [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }, ...byNewest];
    case 'featured':
      // featured → bestseller → in stock → newest (same as the storefront mock)
      return [{ isFeatured: 'desc' }, { isBestseller: 'desc' }, { inStock: 'desc' }, ...byNewest];
  }
}
