import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .max(254, 'That email address is too long.')
  .pipe(z.email('Please enter a valid email address.'))
  .transform((v) => v.toLowerCase());

/** Where the sign-up happened (footer, popup, checkout…), for reporting. */
export const newsletterSources = ['footer', 'popup', 'checkout', 'account', 'other'] as const;

export const subscribeSchema = z.strictObject({
  email: emailSchema,
  source: z.enum(newsletterSources).default('other'),
});
export type SubscribeBody = z.infer<typeof subscribeSchema>;

export const unsubscribeSchema = z.strictObject({
  email: emailSchema,
  /** From the unsubscribe link in every newsletter email. */
  token: z.string().regex(/^[0-9a-f]{32}$/, 'Invalid unsubscribe link.'),
});
export type UnsubscribeBody = z.infer<typeof unsubscribeSchema>;
