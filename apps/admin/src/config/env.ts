import { z } from 'zod';

/** Admin environment (server-side only; nothing here reaches the browser). */
const envSchema = z.object({
  /** The NestJS API the admin server calls (can be an internal network URL). */
  API_URL: z.url().default('http://localhost:4000/api/v1'),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  /** Public address of the storefront, for "View on site" links. */
  STOREFRONT_URL: z.url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse({
  API_URL: process.env.API_URL,
  API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
  STOREFRONT_URL: process.env.STOREFRONT_URL,
});

if (!parsed.success) {
  console.error('❌ Invalid admin environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid admin environment variables');
}

export const env = parsed.data;
