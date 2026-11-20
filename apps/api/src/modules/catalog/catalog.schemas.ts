import { z } from 'zod';

/** URL-safe slug: `lawn`, `ruby-red`, `noor-e-zar-embroidered-lawn-3-piece`. */
export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase slug');

/** "a,b" → ['a','b'] (deduplicated, sorted → stable cache keys). */
const csvOf = (item: z.ZodType<string, string>, max: number) =>
  z
    .string()
    .max(2_000)
    .transform((value) =>
      [
        ...new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ].sort(),
    )
    .pipe(z.array(item).max(max));

const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true');

const minor = z.coerce.number().int().min(0).max(100_000_000);

export const productSorts = ['featured', 'newest', 'price-asc', 'price-desc', 'rating'] as const;
export type ProductSort = (typeof productSorts)[number];

export const MAX_PAGE_SIZE = 48;
const ATTRIBUTE_FILTER = /^f\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * `GET /catalog/products` query. Attribute filters are flat `f.<attributeCode>=v1,v2` params
 * (`?f.fabric=lawn,chiffon&f.size=m`) so admin-created attributes work with no code changes.
 * Unknown params are ignored; invalid values are rejected (422).
 */
export const listProductsQuerySchema = z
  .looseObject({
    category: slugSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    collection: csvOf(slugSchema, 10).optional(),
    tag: csvOf(slugSchema, 10).optional(),
    /** Exact products (wishlist, recently viewed): at most one page of ids or slugs. */
    ids: csvOf(z.uuid(), MAX_PAGE_SIZE).optional(),
    slugs: csvOf(slugSchema, MAX_PAGE_SIZE).optional(),
    sort: z.enum(productSorts).default('featured'),
    /** Price range in minor units (paisa), compared with the product's lowest price. */
    min: minor.optional(),
    max: minor.optional(),
    inStock: flag.optional(),
    sale: flag.optional(),
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12),
  })
  .transform(
    (
      {
        category,
        q,
        collection,
        tag,
        ids,
        slugs,
        sort,
        min,
        max,
        inStock,
        sale,
        page,
        pageSize,
        ...rest
      },
      ctx,
    ) => {
      const attributes: Record<string, string[]> = {};
      for (const [key, raw] of Object.entries(rest)) {
        const code = ATTRIBUTE_FILTER.exec(key)?.[1];
        if (!code) continue; // unknown param: ignored
        const parsed = csvOf(slugSchema, 20).safeParse(raw);
        if (!parsed.success) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'must be a comma-separated list of slugs',
          });
          continue;
        }
        if (parsed.data.length) attributes[code] = parsed.data;
      }
      if (min !== undefined && max !== undefined && min > max) {
        ctx.addIssue({ code: 'custom', path: ['min'], message: 'must not be greater than max' });
      }
      return {
        category,
        q,
        collections: collection ?? [],
        tags: tag ?? [],
        ids: ids ?? [],
        slugs: slugs ?? [],
        attributes,
        sort,
        min,
        max,
        inStock: inStock ?? false,
        sale: sale ?? false,
        page,
        pageSize,
      };
    },
  );

export type ProductListQuery = z.output<typeof listProductsQuerySchema>;

/** Facets are computed for the "universe" a shopper is browsing (category + search + collection). */
export const facetsQuerySchema = z.looseObject({
  category: slugSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  collection: slugSchema.optional(),
});
export type FacetsQuery = z.output<typeof facetsQuerySchema>;

export const relatedQuerySchema = z.looseObject({
  limit: z.coerce.number().int().min(1).max(12).default(4),
});

/** `GET /catalog/variants?ids=…` — fresh price & stock for cart / checkout validation. */
export const variantLookupQuerySchema = z.looseObject({
  ids: z
    .string()
    .max(4_000)
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.uuid()).min(1).max(50)),
});
