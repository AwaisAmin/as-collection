/* Review moderation (`/admin/reviews`). */

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminReviewDto {
  id: string;
  /** PENDING waits for a decision; only APPROVED reviews are public. */
  status: ReviewStatus;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  city: string | null;
  /** Written for a delivered order item. */
  isVerifiedPurchase: boolean;
  /** Picked for the home-page testimonials. */
  isFeatured: boolean;
  helpfulCount: number;
  /** Internal: why it was rejected or unpublished. */
  rejectionReason: string | null;
  moderatedAt: string | null;
  moderatedBy: { id: string; name: string } | null;
  /** The store's public reply, shown under the review. */
  reply: string | null;
  repliedAt: string | null;
  repliedBy: { id: string; name: string } | null;
  createdAt: string;
  product: { id: string; name: string; slug: string };
  customer: { id: string; name: string | null; phone: string | null } | null;
  orderNumber: string | null;
}

/** Newest first; pass `nextCursor` as `before` for the next page (null: no more). */
export interface AdminReviewListDto {
  items: AdminReviewDto[];
  nextCursor: string | null;
}

export type AdminReviewCountsDto = Record<ReviewStatus, number>;
