import type { ReviewInput } from '@/features/catalog/schemas';

export type ReviewField = keyof Omit<ReviewInput, 'productSlug'>;

export type ReviewFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      /** Form-level message (e.g. service unavailable). */
      message?: string;
      fieldErrors: Partial<Record<ReviewField, string>>;
      /** Echo of submitted values so the form keeps what the shopper typed. */
      values: Partial<Record<ReviewField, string>>;
      at: number;
    };

export const initialReviewFormState: ReviewFormState = { status: 'idle' };

/** Hidden anti-bot field (humans never fill it). */
export const REVIEW_HONEYPOT = 'website';
