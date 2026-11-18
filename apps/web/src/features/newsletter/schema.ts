import { z } from 'zod';

/** Shared by the client (instant feedback) and the Server Action (source of truth). */
export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .max(254, 'That email address is too long.')
    .pipe(z.email('Please enter a valid email address.'))
    .transform((v) => v.toLowerCase()),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

export type SubscribeState =
  | { status: 'idle'; email: string }
  | { status: 'success'; message: string; email: string; at: number }
  | { status: 'error'; message: string; email: string; field?: 'email'; at: number };

export const initialSubscribeState: SubscribeState = { status: 'idle', email: '' };

/** Hidden anti-bot field name (must stay empty for humans). */
export const HONEYPOT_FIELD = 'company';
