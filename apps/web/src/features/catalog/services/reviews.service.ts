import 'server-only';

import type { ReviewInput, ReviewSort } from '../schemas';
import type { FeaturedReview, Paginated, Review, ReviewSummary } from '../types';
import { apiReviewsService } from './reviews.api';

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

/** The NestJS reviews API. */
export const reviewsService: ReviewsService = apiReviewsService;
