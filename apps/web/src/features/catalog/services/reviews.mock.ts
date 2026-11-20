import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { mockProducts, mockReviews } from '../data';
import { summarizeReviews } from '../lib/product-helpers';
import { paginate, sortReviews } from '../lib/query-products';
import type { ReviewInput, ReviewSort } from '../schemas';
import type { FeaturedReview, Paginated, Review, ReviewSummary } from '../types';
import type { ReviewsService, SubmittedReview } from './reviews.service';
import { REVIEWS_PAGE_SIZE, REVIEWS_TAG, reviewsTag } from './tags';

/** Mock reviews are keyed by product id; the port uses slugs (like the API). */
const idOf = (slug: string) => mockProducts.find((p) => p.slug === slug)?.id ?? slug;

/* Adapter: in-memory mock (`MOCK_API=true`). Submissions go to a pending queue. */

async function listReviews(
  productSlug: string,
  {
    sort = 'newest',
    page = 1,
    pageSize = REVIEWS_PAGE_SIZE,
  }: { sort?: ReviewSort; page?: number; pageSize?: number } = {},
): Promise<Paginated<Review>> {
  'use cache';
  cacheLife('hours');
  cacheTag(reviewsTag(productSlug));
  const productId = idOf(productSlug);
  const forProduct = mockReviews.filter((r) => r.productId === productId);
  return paginate(sortReviews(forProduct, sort), page, pageSize);
}

async function getSummary(productSlug: string): Promise<ReviewSummary> {
  'use cache';
  cacheLife('hours');
  cacheTag(reviewsTag(productSlug));
  const productId = idOf(productSlug);
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
const votes = new Map<string, number>();

async function submitReview(input: ReviewInput): Promise<SubmittedReview> {
  const id = `pending-${Date.now().toString(36)}`;
  pendingQueue.push({ ...input, id, createdAt: new Date().toISOString() });
  return { id, status: 'pending' };
}

export const mockReviewsService: ReviewsService = {
  async markHelpful(reviewId) {
    const count =
      (votes.get(reviewId) ?? mockReviews.find((r) => r.id === reviewId)?.helpfulCount ?? 0) + 1;
    votes.set(reviewId, count);
    return { helpfulCount: count };
  },
  listReviews,
  getSummary,
  getFeaturedReviews,
  getStoreSummary,
  submitReview,
};
