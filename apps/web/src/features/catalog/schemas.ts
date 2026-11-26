import { z } from 'zod';

import { CATEGORY_SLUG_PATTERN } from '@/config/catalog';
import { isOccasion } from '@/config/occasions';

export const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
] as const;

export type SortValue = (typeof sortOptions)[number]['value'];
const sortValues = sortOptions.map((o) => o.value) as [SortValue, ...SortValue[]];

export const PAGE_SIZE = 12;

/** Comma-separated list in the URL ("S,M") → array; tolerant of repeated params. */
const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : v ? [v] : [])
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** Boolean flag in the URL (`inStock=1`). */
const flag = z
  .enum(['1', 'true'])
  .optional()
  .catch(undefined)
  .transform((v) => v !== undefined);

/** Invalid values fall back to defaults instead of erroring — URLs are user-editable. */
const optionalInt = z.coerce.number().int().nonnegative().optional().catch(undefined);

/**
 * Shop / category / search query, parsed from URL search params.
 * Single source of truth for filters, sorting and pagination.
 */
export const catalogQuerySchema = z.object({
  category: z.string().max(120).regex(CATEGORY_SLUG_PATTERN).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(sortValues).default('featured').catch('featured'),
  min: optionalInt,
  max: optionalInt,
  size: csv,
  shade: csv,
  /** Unknown occasions are dropped rather than rejected. */
  occasion: csv.transform((values) => values.filter(isOccasion)),
  inStock: flag,
  /** Only products with a discounted variant. */
  sale: flag,
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type CatalogQuery = z.output<typeof catalogQuerySchema>;
export type CatalogQueryInput = z.input<typeof catalogQuerySchema>;

/** Next.js `searchParams` → validated query. */
export function parseCatalogQuery(
  params: Record<string, string | string[] | undefined>,
  overrides: Partial<CatalogQueryInput> = {},
): CatalogQuery {
  return catalogQuerySchema.parse({ ...params, ...overrides });
}

export const reviewSortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
  { value: 'helpful', label: 'Most helpful' },
] as const;

export type ReviewSort = (typeof reviewSortOptions)[number]['value'];

export const reviewInputSchema = z.object({
  productSlug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(160),
  rating: z.coerce.number().int().min(1, 'Please select a rating.').max(5),
  title: z.string().trim().min(3, 'Please add a short title.').max(80, 'Title is too long.'),
  body: z
    .string()
    .trim()
    .min(10, 'Please write at least a few words (10+ characters).')
    .max(1500, 'Review is too long (1500 characters max).'),
  author: z.string().trim().min(2, 'Please enter your name (at least 2 letters).').max(60),
  city: z.string().trim().max(60).optional().or(z.literal('')),
});

export type ReviewInput = z.output<typeof reviewInputSchema>;
