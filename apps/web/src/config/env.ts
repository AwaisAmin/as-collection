import { z } from 'zod';

/**
 * Public (browser-safe) environment variables.
 * Each key must be referenced explicitly so Next.js can inline it at build time.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api/v1'),
  /** Google OAuth web client id (Google sign-in button). Unset: Google sign-in is hidden. */
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
    .string()
    .regex(/^[\w-]+\.apps\.googleusercontent\.com$/)
    .optional(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export type Env = typeof env;
