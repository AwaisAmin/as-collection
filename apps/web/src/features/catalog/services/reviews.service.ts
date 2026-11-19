import 'server-only';

import { mockReviews } from '../data';
import { summarizeReviews } from '../lib/product-helpers';
import { paginate, sortReviews } from '../lib/query-products';
import type { ReviewInput, ReviewSort } from '../schemas';
import type { Paginated, Review, ReviewSummary } from '../types';

export const REVIEWS_PAGE_SIZE = 5;

export interface SubmittedReview {
  id: string;
  /** New reviews are moderated before they appear publicly. */
  status: 'pending';
}

/** Port: product reviews. */
export interface ReviewsService {
  listReviews(
    productId: string,
    options?: { sort?: ReviewSort; page?: number; pageSize?: number },
  ): Promise<Paginated<Review>>;
  getSummary(productId: string): Promise<ReviewSummary>;
  submitReview(input: ReviewInput): Promise<SubmittedReview>;
}

/** Adapter: in-memory mock. Submitted reviews go to a pending queue (admin moderation later). */
const pendingQueue: (ReviewInput & { id: string; createdAt: string })[] = [];

const mockReviewsService: ReviewsService = {
  async listReviews(productId, { sort = 'newest', page = 1, pageSize = REVIEWS_PAGE_SIZE } = {}) {
    const forProduct = mockReviews.filter((r) => r.productId === productId);
    return paginate(sortReviews(forProduct, sort), page, pageSize);
  },

  async getSummary(productId) {
    return summarizeReviews(mockReviews.filter((r) => r.productId === productId));
  },

  async submitReview(input) {
    const id = `pending-${Date.now().toString(36)}`;
    pendingQueue.push({ ...input, id, createdAt: new Date().toISOString() });
    return { id, status: 'pending' };
  },
};

export const reviewsService: ReviewsService = mockReviewsService;
