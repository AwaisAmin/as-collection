import type { ReviewDto, ReviewSummaryDto } from '@as/contracts';

import type { Prisma } from '../../generated/prisma/client.js';

export type { ReviewDto, ReviewSummaryDto };
import type { ReviewSort } from './reviews.schemas.js';

export const reviewSelect = {
  id: true,
  productId: true,
  authorName: true,
  city: true,
  rating: true,
  title: true,
  body: true,
  createdAt: true,
  isVerifiedPurchase: true,
  helpfulCount: true,
  reply: true,
  repliedAt: true,
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

export const toReviewDto = (r: ReviewRow): ReviewDto => ({
  id: r.id,
  productId: r.productId,
  author: r.authorName,
  city: r.city,
  rating: r.rating,
  title: r.title,
  body: r.body,
  createdAt: r.createdAt.toISOString(),
  verifiedPurchase: r.isVerifiedPurchase,
  helpfulCount: r.helpfulCount,
  reply: r.reply && r.repliedAt ? { body: r.reply, at: r.repliedAt.toISOString() } : null,
});

/** Summary from per-star counts (grouped APPROVED reviews). */
export function summarize(counts: readonly { rating: number; count: number }[]): ReviewSummaryDto {
  const distribution: ReviewSummaryDto['distribution'] = [0, 0, 0, 0, 0];
  for (const { rating, count } of counts) {
    const index = rating - 1;
    if (index >= 0 && index < 5) distribution[index] = (distribution[index] ?? 0) + count;
  }
  const count = distribution.reduce((sum, n) => sum + n, 0);
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return { average: count ? Math.round((total / count) * 10) / 10 : 0, count, distribution };
}

/** Stable orderings (id breaks ties so pages never overlap). */
export const reviewOrderBy = (sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput[] => {
  const newest: Prisma.ReviewOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];
  switch (sort) {
    case 'highest':
      return [{ rating: 'desc' }, ...newest];
    case 'lowest':
      return [{ rating: 'asc' }, ...newest];
    case 'helpful':
      return [{ helpfulCount: 'desc' }, ...newest];
    default:
      return newest;
  }
};
