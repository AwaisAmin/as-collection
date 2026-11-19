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

| Path                                                                  | What                                                                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/...`                                                         | Versioned API (URI versioning)                                                                                                                  |
| `/api/health/live`                                                    | Liveness — process is up (no dependencies)                                                                                                      |
| `/api/health/ready`                                                   | Readiness — dependencies healthy (load balancer)                                                                                                |
| `/api/docs`                                                           | Swagger UI + `/api/docs/json` (off in production)                                                                                               |
| `/api/v1/catalog/*`                                                   | Public catalog: categories, collections, products (search, `f.<code>` filters, sort, pagination), facets, product page, related, variant lookup |
| `/api/v1/catalog/products/:slug/reviews`, `/api/v1/catalog/reviews/*` | Approved reviews (sort, pagination), per-star summary, featured testimonials, store summary; submit (moderated), helpful votes                  |
| `/api/v1/content/*`                                                   | Storefront content: `pages/:slug` (sections), `menus/:key`, public `settings`, `promotions/active`                                              |
| `/api/v1/newsletter/*`                                                | `subscriptions` (consent recorded), `unsubscribe` (signed token)                                                                                |
| `/api/v1/contact`                                                     | Contact form → admin inbox                                                                                                                      |
| `/api/v1/auth/*`                                                      | Customer sign-in: phone OTP (`otp`, `otp/verify`), Google (`google`), `session`, `logout`                                                       |
| `/api/v1/checkout/quote`, `/api/v1/orders/*`                          | Checkout quote, place order (Idempotency-Key), order view (access key or session), track, cancel, payment proof                                 |
| `/api/v1/account/orders`                                              | Signed-in order history (incl. guest orders linked by verified phone)                                                                           |
| `/api/v1/account/*`                                                   | Signed-in customer: profile, verified phone, address book, signed-in devices                                                                    |
| `/api/v1/admin/auth/*`                                                | Staff sign-in: `login` → `totp/enrol` / `totp/verify` → session; `session`, `logout`, `password`, `permissions`                                 |
| `/api/v1/admin/staff`, `/admin/roles`, `/admin/audit-logs`            | Staff accounts (create, roles, disable, reset password/2FA, unlock, sign out), roles, audit trail                                               |

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

## Checkout & orders

- **Prices come only from the database.** The client sends variant ids, quantities and the total it showed. If the server's total differs, the order isn't placed: the API returns 409 `PRICE_CHANGED` with a fresh `quote` the storefront can sync from. Stock problems return 409 `OUT_OF_STOCK`, coupon problems 409 `DISCOUNT_INVALID`, both with the same `quote`.
- **Placing an order is one transaction:**
  1. Re-price every line.
  2. Reserve stock with conditional updates (`on_hand - reserved >= qty`, taken in variant-id order so checkouts can't deadlock).
  3. Claim one coupon use atomically.
  4. Write the order, snapshotting names, prices, images and the address.

  Concurrent checkouts can't oversell (tested with 6 parallel buyers for 1 unit).

- **Stock:** `reserved` holds units for open orders. Cancelling releases them. Shipping, an admin step in B7, must move them from `reserved` to an `on_hand` decrease (a `SALE` movement).
- **Idempotency:** the `Idempotency-Key` header (16–64 chars) is required.
  - The same key and body returns the original order with 200.
  - The same key with a different body returns 422 `IDEMPOTENCY_KEY_REUSED`.
- **Access:** guests use `X-Order-Access-Key`, a 32-hex key derived by HMAC from `AUTH_SECRET` and the order number. Only its SHA-256 is stored. Owners use their bearer token.
  - A wrong key, unknown number or someone else's order all give the same 404.
  - Orders are linked to the signed-in customer, or to the customer who verified that phone.
- **Tracking** (`POST /orders/track`, number + phone) is strictly rate-limited and shows no name, phone, email or street address.
- **Payment proofs:**
  - **Upload:** multipart `file`, at most 5 MB, one file.
  - **Validation:** the file type is checked from its bytes (JPG, PNG or WEBP), never from its name or Content-Type.
  - **Storage:** files go to the private S3 bucket under a random key, as `attachment`. If recording fails, the object is deleted again.
- **Shipping fee:** comes from the `shipping` setting (cached, `StoreSettingsService.invalidate()`). If it's missing, checkout returns 503 rather than guessing a fee.
- **To do in B7:**
  - Staff order workflow: confirm, ship (stock movement), deliver, refunds.
  - Payment-proof review with signed URLs.
  - A job to auto-cancel unpaid transfer orders.

## Reviews, newsletter, contact & content

- **Reviews:**
  - **Public reads:** only APPROVED reviews, without customer ids, moderation data or IP hashes.
  - **Submissions:** start PENDING; the request body is strict (no `status` or `isVerifiedPurchase`). Text is cleaned of control and bidi characters before length checks.
  - **Verified purchase:** set only when a signed-in customer has a DELIVERED order item for the product.
  - **Limits:** one live review per customer per product (partial unique index); 5 submissions per IP and per customer per day.
  - **Ratings:** `products.rating_*` are kept in sync by a database trigger on every status change.
  - **Helpful votes:** once per voter (customer id, else hashed IP).
- **Newsletter:**
  - Sign-ups record consent (`consentAt`, `source`); re-subscribing is fresh consent.
  - Unsubscribe links carry an HMAC of the address (`NewsletterService.unsubscribeToken`), so no token table is needed and nobody can unsubscribe someone else.
- **Contact:**
  - Messages need a phone or an email (also a DB check); phone and order number are normalised.
  - Limit: 5 per IP per hour, counted by HMAC-hashed IP (raw IPs are never stored).
- **Content:**
  - **Validation on read:** stored JSON goes through per-type Zod schemas in `content.schemas.ts`. Unknown section types and invalid entries are skipped and logged, so one bad edit can't break the storefront.
  - **Links:** only site paths, `https:`, `tel:` or `mailto:` (no `javascript:` or `//host`).
  - **Settings:** only keys listed in `PUBLIC_SETTINGS` are served, and only their listed fields.
  - **Caching:** pages and menus are cached (`ContentService.invalidate()`); section schedules (`startsAt`/`endsAt`) are applied per request; settings share the `settings` cache with checkout.
- **Client IP:** comes from `TRUST_PROXY` via `createHttpAdapter`, which the e2e tests use too.
- **To do in B7:**
  - Moderation and inbox screens (call `ReviewsService.invalidate()`).
  - Staff notifications for new contact messages.
  - Admin content writes validated with the same schemas.

## Staff auth, roles & audit log

- **First administrator:** created from the command line (everyone else is added in the admin panel). The password is read from stdin and 2FA is set up at first sign-in:
  - Locally: `STAFF_EMAIL=owner@… STAFF_NAME="Owner" pnpm staff:create`
  - In production: `docker run -i --env-file … <image> node dist/cli/create-staff.js`
- **Sign-in:**
  - Password (argon2id, OWASP parameters; 12–128 characters) → a 6-digit authenticator code (TOTP, RFC 6238) → an opaque session token.
  - The first sign-in enrols the authenticator: `otpauth://` URI for a QR code.
  - TOTP secrets are encrypted with AES-256-GCM (`STAFF_TOTP_KEY`), bound to their row.
  - Each code works only once (the last used time step is stored).
- **Lockout:**
  - 5 consecutive failures, from the password or the code, lock the account for 15 minutes; each further failure doubles the lock, up to 24 h.
  - Errors never reveal whether an email exists or an account is locked; unknown emails take the same hashing time.
- **Sessions:**
  - Only the token's SHA-256 is stored.
  - Sessions end at logout, after `STAFF_SESSION_IDLE_MINUTES` idle, `STAFF_SESSION_MAX_HOURS` after sign-in, on disable, password reset or 2FA reset.
  - At most 5 per person. Sessions are resolved without a cache, so revocation and role changes apply immediately.
- **Permissions:**
  - Codes are defined in `src/modules/staff/permissions.ts`; roles are sets of codes and `*` is everything.
  - Routes declare `@Staff('orders.write')` (or `@StaffAnyOf(...)`); a guarded route without a declaration is refused.
  - Temporary passwords set by an admin must be changed before any other admin route works (`PASSWORD_CHANGE_REQUIRED`).
- **Safety rules:**
  - Nobody can grant, or act on an account holding, permissions they don't have (`PRIVILEGE_ESCALATION`).
  - Nobody can change their own status or roles.
  - Built-in roles are fixed.
  - At least one active full administrator always remains; access changes are serialised.
- **Audit log:**
  - `AuditService.record(actor, entry, tx)` writes inside the change's transaction. Secret-looking fields are redacted, and IP, user agent and request id are kept.
  - The table is append-only, enforced by a database trigger. Retention purges must run `SET LOCAL app.audit_purge = 'on'` in their transaction.
- **Docker:** argon2's native binding for the image platform is copied into the production bundle, and the build fails if it doesn't load.

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
