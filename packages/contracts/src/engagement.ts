/* Reviews, newsletter, contact — public responses — and the API's error format. */

/** Public review: no customer id, moderation data or IP hash. */
export interface ReviewDto {
  id: string;
  productId: string;
  author: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  /** The store's public answer, if any. */
  reply: { body: string; at: string } | null;
}

export interface FeaturedReviewDto extends ReviewDto {
  product: { name: string; slug: string };
}

export interface ReviewSummaryDto {
  /** One decimal (4.7). */
  average: number;
  count: number;
  /** Count per star: index 0 = 1★ … index 4 = 5★. */
  distribution: [number, number, number, number, number];
}

export interface ReviewPage {
  items: ReviewDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** `POST /catalog/products/:slug/reviews` (202): queued for moderation. */
export interface SubmittedReviewDto {
  id: string;
  status: 'PENDING';
}

/** `POST /newsletter/subscriptions`. */
export interface SubscribeResultDto {
  alreadySubscribed: boolean;
}

/** `POST /contact` (202). */
export interface ContactReceivedDto {
  received: true;
}

/** Newsletter sign-up sources the API accepts. */
export type NewsletterSource = 'footer' | 'popup' | 'checkout' | 'account' | 'other';

/** Contact topics the API accepts. */
export type ContactTopic = 'ORDER' | 'RETURNS' | 'PRODUCT' | 'WHOLESALE' | 'OTHER';

/**
 * Every error response: RFC 9457 Problem Details (`application/problem+json`) with a stable
 * machine-readable `code`; validation failures (422) add one entry per invalid field.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
  requestId?: string;
  errors?: { path: string; message: string }[];
  /** Problem-specific members, e.g. `retryAfterSeconds`, `sku`. */
  [extension: string]: unknown;
}
