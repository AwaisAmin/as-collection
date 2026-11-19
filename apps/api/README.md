# @as/api — AS Collection Hub API

NestJS 12 (ESM) on the Node adapter · TypeScript (strict) · Zod (Standard Schema) validation.

## Run

```bash
pnpm services:up                 # from the repo root: Postgres, Redis, storage
cp .env.example .env
pnpm --filter @as/api db:deploy  # apply migrations
pnpm --filter @as/api db:seed    # starter catalog + content (idempotent, never overwrites)
pnpm --filter @as/api dev        # http://localhost:4000/api · docs at /api/docs
pnpm --filter @as/api test       # unit tests (src/**/*.spec.ts)
pnpm --filter @as/api test:e2e   # boots the real app over HTTP (test/**/*.e2e-spec.ts)
docker build -f apps/api/Dockerfile -t as-collection-api .   # from the repo root
```

## Routes

| Path                | What                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/...`       | Versioned API (URI versioning)                                                                                                                  |
| `/api/health/live`  | Liveness — process is up (no dependencies)                                                                                                      |
| `/api/health/ready` | Readiness — dependencies healthy (load balancer)                                                                                                |
| `/api/docs`         | Swagger UI + `/api/docs/json` (off in production)                                                                                               |
| `/api/v1/catalog/*` | Public catalog: categories, collections, products (search, `f.<code>` filters, sort, pagination), facets, product page, related, variant lookup |

| `/api/v1/auth/*` | Customer sign-in: phone OTP (`otp`, `otp/verify`), Google (`google`), `session`, `logout` |
| `/api/v1/account/*` | Signed-in customer: profile, verified phone, address book, signed-in devices |

## Structure

```
src/
  main.ts                  # load + validate env, create app (NodeAdapter), listen
  app.module.ts            # AppModule.forRoot(env): config, rate limiting, feature modules
  bootstrap/configure-app  # prefix, versioning, security headers, CORS, CSRF, validation, errors, docs
  config/env.ts            # Zod schema for every environment variable (fails fast)
  common/
    http/                  # Problem Details errors, validation pipe, request id + access log
    logging/               # JSON logs in production, secret redaction
    request-context.ts     # AsyncLocalStorage: request id available everywhere
  modules/<feature>/       # one Nest module per domain (health, catalog, orders, …)
test/                      # e2e tests + helpers (createTestApp)
```

## Database (PostgreSQL 18 + Prisma 7)

Schema: `prisma/schema/*.prisma`, one file per domain:

- `catalog`: categories (any depth), attributes and values, products, variants, inventory, media, collections.
- `reviews`
- `customers`: OTP, sessions and addresses.
- `orders`: payments and discounts.
- `content`: pages and sections, menus, settings, newsletter and contact messages.
- `staff`: roles and permissions, sessions, audit log.

| Script                   | What                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `db:migrate`             | create + apply a migration in development (`--create-only` to edit SQL first) |
| `db:deploy`              | apply pending migrations (CI, production release step)                        |
| `db:seed`                | idempotent, create-only seed from `prisma/seed/data/*.json`                   |
| `db:generate`            | regenerate the typed client into `src/generated/` (also on install/build)     |
| `db:studio` / `db:reset` | browse data / drop and re-create the dev database                             |

Rules:

- **Money**: integer minor units (paisa) in `*Minor` columns. Never floats.
- **IDs**: UUIDv7.
- **Timestamps**: `timestamptz`.
- **Naming**: snake_case in SQL, camelCase in TypeScript.
- **Integrity in the database**: CHECK constraints are hand-written at the end of migrations (prices ≥ 0, compare-at > price, stock, ratings 1–5, E.164 phones, order totals add up). CI fails if the schema drifts from the migrations.
- **Admin-editable content** (`page_sections.settings`, `menu_items.settings`, `settings.value`) is JSON validated by Zod in the API, so new section types need no migration.
- **Production**: run the `migrator` image target before starting new API instances.

## Catalog reads & caching

- **Listing summary columns**: `products.price_min_minor`, `compare_at_minor`, `is_on_sale`, `in_stock` and `rating_*` are maintained by **database triggers** on variants, inventory and reviews, so listings filter and sort without aggregating, and every write path stays consistent. Never write them from the app.
- **Redis read-through cache** (`CacheService`), namespace `catalog`:
  - **Invalidation:** `CatalogService.invalidate()` bumps a version, so every entry goes stale at once in O(1).
  - **No stampedes:** concurrent misses share one query.
  - **Fail-open:** if Redis is down the API serves from Postgres, and readiness reports `degraded` but still returns 200.
- **Uncached by design**: `GET /catalog/variants`, the price and stock checks for cart and checkout.
- **Stock privacy**: customers see `availableQuantity` capped at 10, never exact stock.

## Customer auth

- **Who calls it:** the storefront's Next.js server, not the browser.
  - It stores the returned `token` in an HttpOnly cookie and sends it as `Authorization: Bearer <token>`.
  - It forwards the shopper's IP via `X-Forwarded-For`; list that server in `TRUST_PROXY` so the per-IP limits see real clients.
- **Phone OTP:** 6-digit, single-use codes. They expire after 5 minutes and allow 5 guesses; requesting a new code replaces the old one.
  - **Limits:** a 30 s cooldown, 5 codes per phone per 15 minutes, and 20 per IP per hour. They're counted in Postgres, so they hold across instances and without Redis.
  - **Concurrency:** requests for one phone are serialized with an advisory lock. Guesses are claimed with conditional updates, so parallel requests can't bypass any limit.
  - **Storage:** only HMACs of the code and the IP are stored, keyed by `AUTH_SECRET`.
- **Delivery:** `OTP_CHANNELS` lists the channels in fallback order, for example `whatsapp,sms` (WhatsApp Cloud authentication template, then Twilio SMS).
  - `log` plus `OTP_DEV_ECHO` is for local development only; env validation rejects both in production.
- **Google:** Google Identity Services ID tokens are verified with Google's keys and checked against issuer, audience (`GOOGLE_CLIENT_IDS`) and expiry.
  - Accounts link by Google id, or by an email that is verified. A typed-in email never links, which prevents account pre-hijacking.
- **Sessions:** opaque 256-bit tokens, stored as SHA-256 hashes.
  - **Expiry:** `SESSION_TTL_DAYS` from last use, with an absolute cap of 180 days. Activity is written at most hourly.
  - **Cache:** lookups are cached for 60 s in Redis, and revoking a session deletes its entry. Blocking a customer must call `SessionService.revokeAll`.
  - **Limit:** at most 10 active sessions per customer; the oldest is revoked.
- **Account data:** verifying a phone links earlier guest orders placed with it.
  - **Addresses:** up to 20; there's always exactly one default, enforced by a partial unique index.
- **Rate limits:** the global and `@StrictRateLimit()` limits (`AUTH_RATE_LIMIT_MAX` per minute) are counted in Redis and shared by all instances. If Redis is down they fall back to per-process memory.
- **To do in B7:** a cleanup job for expired codes and sessions.

## Conventions

- **Errors**: always RFC 9457 Problem Details (`application/problem+json`) with a stable `code`,
  the `requestId`, and `errors[]` for validation. 5xx internals never reach clients in production.
  Business errors: `throw new DomainException(HttpStatus.CONFLICT, 'OUT_OF_STOCK', '…')`.
- **Validation**: `@Body({ schema })`, `@Query({ schema })`, `@Param('id', { schema })` with Zod.
  Prefer `z.strictObject` for request bodies (unknown keys are rejected).
- **Config**: add every new variable to `config/env.ts` and `.env.example`; read it with
  `AppConfig` (`config.get('PORT', { infer: true })`). Never read `process.env` elsewhere.
- **Security**: Helmet-equivalent headers, strict CORS allow-list, Fetch-Metadata CSRF check,
  per-IP rate limiting (health checks exempt), body limit 100 kB, `__proto__` payloads rejected,
  non-root Docker image.
- **ESM**: relative imports end in `.js`; use `import.meta.dirname`, not `__dirname`.
