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

/** OTP delivery channels, tried in order: `whatsapp,sms` sends by WhatsApp and falls back to SMS. */
export const otpChannels = ['whatsapp', 'sms', 'log'] as const;

/** Development-only secret; production must set its own (enforced below). */
const DEV_AUTH_SECRET = 'dev-only-auth-secret-never-use-in-production';

const optionalString = z.string().trim().min(1).optional();

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
    /** Stricter limit for sign-in routes (`@StrictRateLimit()`), per client IP per minute. */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

    /** postgresql://user:password@host:port/db?schema=public */
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).describe('PostgreSQL connection string'),
    /** Connections per API instance. Total across instances must stay below Postgres max_connections. */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    /** Cancel any single query running longer than this (protects the pool from runaway queries). */
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

    /** redis://:password@host:port/db — cache now; rate limits, queues and sessions later. */
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    /** How long catalog reads stay cached. Admin edits invalidate immediately regardless. */
    CATALOG_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86_400).default(300),
    /** Public base URL of stored media (CDN in production); keys are appended: <base>/<key>. */
    MEDIA_PUBLIC_BASE_URL: z
      .url({ protocol: /^https?$/ })
      .default('http://localhost:3000')
      .transform((url) => url.replace(/\/+$/, '')),

    /**
     * S3-compatible object storage (RustFS locally; S3, R2 or Spaces in production). Without keys the
     * SDK's default chain is used (IAM role, env, profile). Path-style for RustFS/MinIO.
     */
    S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: booleanFlag.default(false),
    /** Bucket for private files (payment screenshots). Never public; staff read via signed URLs. */
    S3_PRIVATE_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .default('as-private'),

    /**
     * Server secret (≥ 32 chars) keying the OTP and IP hashes. Rotating it invalidates pending login
     * codes only. Generate with `openssl rand -base64 48`. Required in production.
     */
    AUTH_SECRET: z.string().min(32).optional(),
    /** Customer sessions slide: each use extends them to this many days (absolute cap 180 days). */
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
    /** OTP channels in fallback order, e.g. `whatsapp,sms`. `log` (development only) logs the code. */
    OTP_CHANNELS: csv
      .pipe(z.array(z.enum(otpChannels)))
      .transform((list) =>
        list.length
          ? [...new Set(list)]
          : (['log'] as const satisfies (typeof otpChannels)[number][]),
      ),
    /** Development/test only: return the OTP in the API response (for the local login UI). */
    OTP_DEV_ECHO: booleanFlag.default(false),

    /** WhatsApp Cloud API (Meta). The template must be an approved AUTHENTICATION template. */
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_ACCESS_TOKEN: optionalString,
    WHATSAPP_OTP_TEMPLATE: z.string().min(1).default('login_code'),
    WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default('en'),
    WHATSAPP_GRAPH_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .default('v23.0'),

    /** SMS via Twilio. `TWILIO_FROM` is a sender number (E.164) or a Messaging Service SID (MG…). */
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM: optionalString,

    /** Google OAuth client ids whose ID tokens are accepted (web, later mobile). Empty = disabled. */
    GOOGLE_CLIENT_IDS: csv,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'is required in production (comma-separated list of allowed origins)',
      });
    }
    const production = env.NODE_ENV === 'production';
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (production && !env.AUTH_SECRET) issue('AUTH_SECRET', 'is required in production');
    if (production && env.AUTH_SECRET === DEV_AUTH_SECRET) {
      issue('AUTH_SECRET', 'must not be the development secret');
    }
    if (production && env.OTP_CHANNELS.includes('log')) {
      issue('OTP_CHANNELS', '"log" is not allowed in production (codes would only be logged)');
    }
    if (production && env.OTP_DEV_ECHO) issue('OTP_DEV_ECHO', 'must be false in production');
    if (
      env.OTP_CHANNELS.includes('whatsapp') &&
      !(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN)
    ) {
      issue('OTP_CHANNELS', 'whatsapp needs WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN');
    }
    if (
      env.OTP_CHANNELS.includes('sms') &&
      !(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
    ) {
      issue('OTP_CHANNELS', 'sms needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM');
    }
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    AUTH_SECRET: env.AUTH_SECRET ?? DEV_AUTH_SECRET,
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
