import { z } from 'zod';

import { optionalPlainText, plainText } from '../../common/text.js';

export const reviewSorts = ['newest', 'highest', 'lowest', 'helpful'] as const;
export type ReviewSort = (typeof reviewSorts)[number];

export const REVIEWS_MAX_PAGE_SIZE = 20;

export const listReviewsQuerySchema = z.looseObject({
  sort: z.enum(reviewSorts).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(REVIEWS_MAX_PAGE_SIZE).default(5),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const featuredReviewsQuerySchema = z.looseObject({
  limit: z.coerce.number().int().min(1).max(12).default(8),
});

export const reviewIdParamSchema = z.uuid();

/** Same limits as the storefront form; stored text is cleaned (see `cleanText`). */
export const submitReviewSchema = z.strictObject({
  rating: z.number().int().min(1, 'Please select a rating.').max(5),
  title: plainText({
    min: 3,
    max: 80,
    tooShort: 'Please add a short title.',
    tooLong: 'Title is too long.',
  }),
  body: plainText({
    min: 10,
    max: 1500,
    multiline: true,
    tooShort: 'Please write at least a few words (10+ characters).',
    tooLong: 'Review is too long (1500 characters max).',
  }),
  author: plainText({ min: 2, max: 60, tooShort: 'Please enter your name.' }),
  city: optionalPlainText({ max: 60 }),
});
export type SubmitReviewBody = z.infer<typeof submitReviewSchema>;
