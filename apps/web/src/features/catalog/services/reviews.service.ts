import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { mockProducts, mockReviews } from '../data';
import { summarizeReviews } from '../lib/product-helpers';
import { paginate, sortReviews } from '../lib/query-products';
import type { ReviewInput, ReviewSort } from '../schemas';
import type { FeaturedReview, Paginated, Review, ReviewSummary } from '../types';

export const REVIEWS_PAGE_SIZE = 5;

/** Cache tag for a product's reviews — admin moderation calls `revalidateTag(reviewsTag(id))`. */
export const reviewsTag = (productId: string) => `reviews:${productId}`;

/** Cache tag for store-wide review reads (home testimonials). */
export const REVIEWS_TAG = 'reviews';

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
  /** Best recent reviews across the store, at most one per product (home testimonials). */
  getFeaturedReviews(limit?: number): Promise<FeaturedReview[]>;
  /** Rating summary across every product. */
  getStoreSummary(): Promise<ReviewSummary>;
  submitReview(input: ReviewInput): Promise<SubmittedReview>;
}

/* Adapter: in-memory mock. Submitted reviews go to a pending queue (admin moderation later). */

async function listReviews(
  productId: string,
  {
    sort = 'newest',
    page = 1,
    pageSize = REVIEWS_PAGE_SIZE,
  }: { sort?: ReviewSort; page?: number; pageSize?: number } = {},
): Promise<Paginated<Review>> {
  'use cache';
  cacheLife('hours');
  cacheTag(reviewsTag(productId));
  const forProduct = mockReviews.filter((r) => r.productId === productId);
  return paginate(sortReviews(forProduct, sort), page, pageSize);
}

async function getSummary(productId: string): Promise<ReviewSummary> {
  'use cache';
  cacheLife('hours');
  cacheTag(reviewsTag(productId));
  return summarizeReviews(mockReviews.filter((r) => r.productId === productId));
}

/** Five-star, verified, with enough text to quote. */
const isQuotable = (r: Review) => r.rating === 5 && r.verifiedPurchase && r.body.length >= 60;

async function getFeaturedReviews(limit = 8): Promise<FeaturedReview[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(REVIEWS_TAG);
  const products = new Map(mockProducts.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const featured: FeaturedReview[] = [];
  for (const review of sortReviews(mockReviews.filter(isQuotable), 'newest')) {
    const product = products.get(review.productId);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    featured.push({ ...review, product: { name: product.name, slug: product.slug } });
    if (featured.length === limit) break;
  }
  return featured;
}

async function getStoreSummary(): Promise<ReviewSummary> {
  'use cache';
  cacheLife('hours');
  cacheTag(REVIEWS_TAG);
  return summarizeReviews(mockReviews);
}

const pendingQueue: (ReviewInput & { id: string; createdAt: string })[] = [];

async function submitReview(input: ReviewInput): Promise<SubmittedReview> {
  const id = `pending-${Date.now().toString(36)}`;
  pendingQueue.push({ ...input, id, createdAt: new Date().toISOString() });
  return { id, status: 'pending' };
}

export const reviewsService: ReviewsService = {
  listReviews,
  getSummary,
  getFeaturedReviews,
  getStoreSummary,
  submitReview,
};
