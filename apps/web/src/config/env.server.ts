import 'server-only';

import { z } from 'zod';

/**
 * Server-only environment. Never imported by Client Components (enforced by `server-only`).
 */
const serverEnvSchema = z.object({
  /** Base URL the Next.js server uses to call the NestJS API (can be an internal network URL). */
  API_URL: z.url().default('http://localhost:4000/api/v1'),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  /**
   * Shared secret the API sends to `POST /api/revalidate` after staff edits (≥ 32 chars;
   * the API's STOREFRONT_REVALIDATE_SECRET). Unset: the endpoint is disabled.
   */
  REVALIDATE_SECRET: z.string().min(32).optional(),
});

const parsed = serverEnvSchema.safeParse({
  API_URL: process.env.API_URL,
  API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET || undefined,
});

if (!parsed.success) {
  console.error('❌ Invalid server environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid server environment variables');
}

export const serverEnv = parsed.data;
