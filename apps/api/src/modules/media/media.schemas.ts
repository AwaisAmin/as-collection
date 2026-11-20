import { z } from 'zod';

import { clearableText, optionalPlainText } from '../../common/text.js';

/** Largest accepted upload (phone photos included); the stored WebP is far smaller. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const altText = optionalPlainText({ max: 300 });

export const uploadFieldsSchema = z.object({ alt: altText });

export const updateMediaSchema = z.object({ alt: clearableText({ max: 300 }) });

export const listMediaQuerySchema = z.object({
  /** Matches the alt text. */
  q: z.string().trim().min(1).max(100).optional(),
  /** Only images not used anywhere (clean-up). */
  unused: z
    .enum(['1', 'true', '0', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  /** Keyset paging: the last `id` of the previous page. */
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
