'use server';

import { z } from 'zod';

import { reviewInputSchema, type ReviewSort, reviewSortOptions } from '@/features/catalog/schemas';
import { reviewsService } from '@/features/catalog/services/reviews.service';
import type { Paginated, Review } from '@/features/catalog/types';
import { reportError } from '@/lib/errors/report-error';

import { REVIEW_HONEYPOT, type ReviewField, type ReviewFormState } from './types';

const loadSchema = z.object({
  productId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  sort: z.enum(reviewSortOptions.map((o) => o.value) as [ReviewSort, ...ReviewSort[]]),
  page: z.number().int().min(1).max(500),
});

/** Paginated/sorted reviews for "Load more" and sort changes. */
export async function loadReviews(
  productId: string,
  sort: ReviewSort,
  page: number,
): Promise<Paginated<Review> | null> {
  const parsed = loadSchema.safeParse({ productId, sort, page });
  if (!parsed.success) return null;
  return reviewsService.listReviews(parsed.data.productId, {
    sort: parsed.data.sort,
    page: parsed.data.page,
  });
}

const FIELDS: ReviewField[] = ['rating', 'title', 'body', 'author', 'city'];

export async function submitReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  // Bots fill every field; pretend success and drop it.
  if (String(formData.get(REVIEW_HONEYPOT) ?? '').length > 0) return { status: 'success' };

  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? '')]),
  ) as Record<ReviewField, string>;

  const parsed = reviewInputSchema.safeParse({
    ...values,
    productId: String(formData.get('productId') ?? ''),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>;
    const fieldErrors = Object.fromEntries(
      FIELDS.flatMap((f) => (flat[f]?.[0] ? [[f, flat[f]![0]]] : [])),
    ) as Partial<Record<ReviewField, string>>;
    return {
      status: 'error',
      message: flat.productId ? 'Something went wrong. Please refresh and try again.' : undefined,
      fieldErrors,
      values,
      at: Date.now(),
    };
  }

  try {
    await reviewsService.submitReview(parsed.data);
    return { status: 'success' };
  } catch (error) {
    reportError(error, { action: 'reviews.submit' });
    return {
      status: 'error',
      message: "We couldn't submit your review right now. Please try again shortly.",
      fieldErrors: {},
      values,
      at: Date.now(),
    };
  }
}
