import { summarizeReviews, toRatingSummary } from '../lib/product-helpers';
import type { Product } from '../types';
import { rawProducts } from './products';
import { mockReviews } from './reviews';

/** Mock products with ratings derived from their reviews (so the two always agree). */
export const mockProducts: readonly Product[] = rawProducts.map((product) => ({
  ...product,
  rating: toRatingSummary(summarizeReviews(mockReviews.filter((r) => r.productId === product.id))),
}));

export { mockReviews };
