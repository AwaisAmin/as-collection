import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

/** "a, b,c" → ['a', 'b', 'c'] */
const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const booleanFlag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/** An origin is scheme + host (+ port) only: `https://admin.example.com`, no path or trailing slash. */
const origin = z.url().refine((value) => new URL(value).origin === value, {
  message: 'must be an origin like https://example.com (no path or trailing slash)',
});

export const logLevels = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    /** Minimum level written to the log. */
    LOG_LEVEL: z.enum(logLevels).default('log'),
    /** Browser origins allowed to call the API with credentials (storefront, admin). */
    CORS_ORIGINS: csv.pipe(z.array(origin)),
    /**
     * Which proxies to trust for the client IP (rate limiting, logs): `loopback`, a CIDR list such as
     * `10.0.0.0/8,172.16.0.0/12`, or `false`. Never a hop count — that trusts no proxy at all.
     */
    TRUST_PROXY: z.string().default('loopback'),
    /** Interactive API docs at /api/docs. Defaults to on outside production. */
    SWAGGER_ENABLED: booleanFlag.optional(),
    /** Default rate limit per client IP: RATE_LIMIT_MAX requests per RATE_LIMIT_TTL_MS. */
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

    /** postgresql://user:password@host:port/db?schema=public */
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).describe('PostgreSQL connection string'),
    /** Connections per API instance. Total across instances must stay below Postgres max_connections. */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    /** Cancel any single query running longer than this (protects the pool from runaway queries). */
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'is required in production (comma-separated list of allowed origins)',
      });
    }
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.output<typeof envSchema>;

export class InvalidEnvironmentError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid environment variables:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/** Validates raw variables; throws one error listing every problem (never a partial config). */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidEnvironmentError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

/**
 * Loads `.env` then `.env.local` from the working directory (if present) into `process.env`.
 * Real environment variables always win — `process.loadEnvFile` never overwrites them.
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(cwd, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
