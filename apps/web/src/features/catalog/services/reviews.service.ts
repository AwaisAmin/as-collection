import 'server-only';

import { serverEnv } from '@/config/env.server';

import type { ReviewInput, ReviewSort } from '../schemas';
import type { FeaturedReview, Paginated, Review, ReviewSummary } from '../types';
import { apiReviewsService } from './reviews.api';
import { mockReviewsService } from './reviews.mock';

export { REVIEWS_PAGE_SIZE, REVIEWS_TAG, reviewsTag } from './tags';

export interface SubmittedReview {
  id: string;
  /** New reviews are moderated before they appear publicly. */
  status: 'pending';
}

/** Port: product reviews, addressed by product slug. */
export interface ReviewsService {
  listReviews(
    productSlug: string,
    options?: { sort?: ReviewSort; page?: number; pageSize?: number },
  ): Promise<Paginated<Review>>;
  getSummary(productSlug: string): Promise<ReviewSummary>;
  /** Best recent reviews across the store, at most one per product (home testimonials). */
  getFeaturedReviews(limit?: number): Promise<FeaturedReview[]>;
  /** Rating summary across every product. */
  getStoreSummary(): Promise<ReviewSummary>;
  submitReview(input: ReviewInput, client: { ip: string | null }): Promise<SubmittedReview>;
  /** One vote per shopper; repeat votes are ignored. Returns the new count. */
  markHelpful(reviewId: string, client: { ip: string | null }): Promise<{ helpfulCount: number }>;
}

/** The NestJS API, or in-memory mocks for offline development (`MOCK_API=true`). */
export const reviewsService: ReviewsService = serverEnv.MOCK_API
  ? mockReviewsService
  : apiReviewsService;
