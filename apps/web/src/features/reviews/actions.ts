'use server';

import { z } from 'zod';

import { reviewInputSchema, type ReviewSort, reviewSortOptions } from '@/features/catalog/schemas';
import { reviewsService } from '@/features/catalog/services/reviews.service';
import type { Paginated, Review } from '@/features/catalog/types';
import { clientIp } from '@/lib/api/client-ip';
import { ApiError } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import { REVIEW_HONEYPOT, type ReviewField, type ReviewFormState } from './types';

const loadSchema = z.object({
  productSlug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(160),
  sort: z.enum(reviewSortOptions.map((o) => o.value) as [ReviewSort, ...ReviewSort[]]),
  page: z.number().int().min(1).max(500),
});

/** Paginated/sorted reviews for "Load more" and sort changes. */
export async function loadReviews(
  productSlug: string,
  sort: ReviewSort,
  page: number,
): Promise<Paginated<Review> | null> {
  const parsed = loadSchema.safeParse({ productSlug, sort, page });
  if (!parsed.success) return null;
  return reviewsService.listReviews(parsed.data.productSlug, {
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
    productSlug: String(formData.get('productSlug') ?? ''),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>;
    const fieldErrors = Object.fromEntries(
      FIELDS.flatMap((f) => (flat[f]?.[0] ? [[f, flat[f]![0]]] : [])),
    ) as Partial<Record<ReviewField, string>>;
    return {
      status: 'error',
      message: flat.productSlug ? 'Something went wrong. Please refresh and try again.' : undefined,
      fieldErrors,
      values,
      at: Date.now(),
    };
  }

  try {
    await reviewsService.submitReview(parsed.data, { ip: await clientIp() });
    return { status: 'success' };
  } catch (error) {
    const failed = (message: string, fieldErrors: Partial<Record<ReviewField, string>> = {}) =>
      ({ status: 'error', message, fieldErrors, values, at: Date.now() }) as const;
    if (error instanceof ApiError) {
      if (error.status === 422) {
        const fieldErrors = Object.fromEntries(
          Object.entries(error.fieldErrors).filter(([k]) => (FIELDS as string[]).includes(k)),
        ) as Partial<Record<ReviewField, string>>;
        return failed('Please check the highlighted fields.', fieldErrors);
      }
      if (error.status === 409) return failed('You have already reviewed this product. Thank you!');
      if (error.status === 429)
        return failed('Too many reviews from your connection. Please try again later.');
      if (error.status === 404) return failed('This product is no longer available.');
    }
    reportError(error, { action: 'reviews.submit' });
    return failed("We couldn't submit your review right now. Please try again shortly.");
  }
}

const reviewIdSchema = z.string().min(1).max(64);

/** "Helpful" vote: once per shopper (the API ignores repeats). Returns the new count. */
export async function markReviewHelpful(reviewId: string): Promise<number | null> {
  const parsed = reviewIdSchema.safeParse(reviewId);
  if (!parsed.success) return null;
  try {
    const { helpfulCount } = await reviewsService.markHelpful(parsed.data, {
      ip: await clientIp(),
    });
    return helpfulCount;
  } catch (error) {
    reportError(error, { action: 'reviews.helpful' });
    return null;
  }
}
