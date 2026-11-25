import type { AdminReviewCountsDto, ReviewStatus } from '@as/contracts';
import { z } from 'zod';

/*
 * The review list's URL state: `?view=pending&q=lawn&rating=1&featured=1&product=…&before=…`.
 * Anything invalid is dropped, so a mistyped link still opens the list. Paging is by cursor
 * (`before` = the last review shown), newest first.
 */

export const REVIEW_VIEWS = [
  { key: 'pending', label: 'Waiting', status: 'PENDING' },
  { key: 'published', label: 'Published', status: 'APPROVED' },
  { key: 'rejected', label: 'Rejected', status: 'REJECTED' },
  { key: 'all', label: 'All', status: undefined },
] as const satisfies readonly { key: string; label: string; status?: ReviewStatus }[];

export type ReviewView = (typeof REVIEW_VIEWS)[number]['key'];

export const REVIEW_PAGE_SIZE = 20;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional().catch(undefined));

const searchSchema = z.object({
  view: z.preprocess(
    first,
    z.enum(REVIEW_VIEWS.map((v) => v.key) as [ReviewView, ...ReviewView[]]).catch('pending'),
  ),
  q: optional(z.string().trim().min(1).max(100)),
  rating: optional(z.coerce.number().int().min(1).max(5)),
  featured: optional(z.literal('1')),
  product: optional(z.uuid()),
  before: optional(z.uuid()),
});

export interface ReviewListQuery {
  view: ReviewView;
  q?: string;
  rating?: number;
  featured?: '1';
  product?: string;
  before?: string;
}

export function parseReviewQuery(params: Record<string, unknown>): ReviewListQuery {
  const parsed = searchSchema.parse(params);
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  ) as unknown as ReviewListQuery;
}

/** The API query for a list query. */
export function toApiQuery(query: ReviewListQuery): Record<string, string | number | undefined> {
  return {
    status: REVIEW_VIEWS.find((v) => v.key === query.view)?.status,
    q: query.q,
    rating: query.rating,
    featured: query.featured,
    product: query.product,
    before: query.before,
    limit: REVIEW_PAGE_SIZE,
  };
}

/** `/reviews?…` with `change` applied (undefined removes a key). */
export function reviewListHref(
  query: ReviewListQuery,
  change: Partial<Record<keyof ReviewListQuery, string | number | undefined>>,
): string {
  const merged: Record<string, string | number | undefined> = { ...query, ...change };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') continue;
    if (key === 'view' && value === 'pending') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `/reviews?${search}` : '/reviews';
}

export const viewCount = (view: ReviewView, counts: AdminReviewCountsDto | null): number | null => {
  const status = REVIEW_VIEWS.find((v) => v.key === view)?.status;
  return status === 'PENDING' && counts ? counts.PENDING : null;
};
