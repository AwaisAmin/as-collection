import 'server-only';

import type {
  FeaturedReviewDto,
  ReviewPage,
  ReviewSummaryDto,
  SubmittedReviewDto,
} from '@as/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { apiRequest } from '@/lib/api/http-client';

import type { ReviewInput, ReviewSort } from '../schemas';
import type { FeaturedReview, Paginated, Review, ReviewSummary } from '../types';
import { toFeaturedReview, toReview, toReviewSummary } from './api-mappers';
import type { ReviewsService } from './reviews.service';
import { REVIEWS_PAGE_SIZE, REVIEWS_TAG, reviewsTag } from './tags';

/* Adapter: the NestJS reviews API (approved reviews only; submissions are moderated). */

const productPath = (slug: string) => `/catalog/products/${encodeURIComponent(slug)}`;

async function listReviews(
  productSlug: string,
  {
    sort = 'newest',
    page = 1,
    pageSize = REVIEWS_PAGE_SIZE,
  }: { sort?: ReviewSort; page?: number; pageSize?: number } = {},
): Promise<Paginated<Review>> {
  'use cache';
  cacheLife('minutes');
  cacheTag(reviewsTag(productSlug), REVIEWS_TAG);
  const result = await apiRequest<ReviewPage>(`${productPath(productSlug)}/reviews`, {
    query: { sort, page, pageSize },
  });
  return { ...result, items: result.items.map(toReview) };
}

async function getSummary(productSlug: string): Promise<ReviewSummary> {
  'use cache';
  cacheLife('minutes');
  cacheTag(reviewsTag(productSlug), REVIEWS_TAG);
  return toReviewSummary(
    await apiRequest<ReviewSummaryDto>(`${productPath(productSlug)}/reviews/summary`),
  );
}

async function getFeaturedReviews(limit = 8): Promise<FeaturedReview[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(REVIEWS_TAG);
  const items = await apiRequest<FeaturedReviewDto[]>('/catalog/reviews/featured', {
    query: { limit: Math.min(limit, 12) },
  });
  return items.map(toFeaturedReview);
}

async function getStoreSummary(): Promise<ReviewSummary> {
  'use cache';
  cacheLife('minutes');
  cacheTag(REVIEWS_TAG);
  return toReviewSummary(await apiRequest<ReviewSummaryDto>('/catalog/reviews/summary'));
}

export const apiReviewsService: ReviewsService = {
  listReviews,
  getSummary,
  getFeaturedReviews,
  getStoreSummary,
  async submitReview(input: ReviewInput, client) {
    const { productSlug, rating, title, body, author, city } = input;
    const result = await apiRequest<SubmittedReviewDto>(`${productPath(productSlug)}/reviews`, {
      method: 'POST',
      body: { rating, title, body, author, ...(city ? { city } : {}) },
      clientIp: client.ip,
    });
    return { id: result.id, status: 'pending' };
  },
  markHelpful: (reviewId, client) =>
    apiRequest<{ helpfulCount: number }>(
      `/catalog/reviews/${encodeURIComponent(reviewId)}/helpful`,
      {
        method: 'POST',
        clientIp: client.ip,
      },
    ),
};
