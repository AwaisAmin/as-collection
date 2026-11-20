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
| `/api/v1/admin/orders/*`                                              | Staff orders: search, counts, confirm → process → ship → deliver, cancel, return, refund, notes, payment-proof review (signed URLs)             |
| `/api/v1/admin/media`                                                 | Staff image library: upload (WebP + responsive copies, de-duplicated), alt text, delete unused                                                  |
| `/api/v1/admin/products/*`                                            | Staff products: search, create with variants, edit (conflict-safe), variants, delete never-ordered                                              |
| `/api/v1/admin/inventory/*`                                           | Stock list (low / out / backorder), ledgered adjustments, stock settings, history                                                               |
| `/api/v1/admin/categories/*`                                          | Category tree: create, edit, move with subtree, reorder, delete empty                                                                           |
| `/api/v1/admin/attributes/*`, `/admin/brands`                         | Attributes and values (filters / variant options), brands                                                                                       |
| `/api/v1/admin/collections/*`                                         | Collections: hand-picked lists or checked rules, rule preview, schedule, order                                                                  |
| `/api/v1/admin/discounts/*`                                           | Discount codes: create, edit (future checkouts only), state filter, results, delete unused                                                      |
| `/api/v1/admin/pages/*`                                               | Pages and their sections (validated per type), reorder, schedule, publish                                                                       |
| `/api/v1/admin/menus/:key`, `/admin/settings/:key`                    | Menus (whole-tree save), store settings (validated per key, refresh checkout at once)                                                           |

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

## Staff order workflow & jobs

- **State machine:** the rules live in `orders/admin/order-workflow.ts` (pure and unit-tested). Each order response includes `actions`, the steps possible now, for the admin panel's buttons.
  - `PENDING → confirm → CONFIRMED → (process) → ship → SHIPPED → deliver → DELIVERED`
  - `cancel` works before shipping.
  - `return` works after shipping or delivery.
  - `refund` applies to paid orders that were cancelled or returned.
  - Transfers can only be confirmed or shipped once the payment is verified (`PAYMENT_NOT_VERIFIED`).
- **Stock** (`orders/stock.ts`, lines processed in variant-id order):
  - Checkout reserves the units.
  - `ship` turns the reservation into a sale: `on_hand` drops, with a SALE movement. If units aren't physically there, it returns 409 `INSUFFICIENT_STOCK`.
  - `cancel` releases the reservation and the coupon use.
  - `return` with `restock: true` adds the units back, with a RETURN movement.
- **Every change:**
  - Locks the order row, re-checks the state machine, and writes timeline events in the same transaction as an audit entry.
  - Timeline events are either customer-visible (standard messages) or internal (reasons, staff notes).
  - Double clicks get 409.
- **Payment proofs:**
  - **Viewing:** `GET …/payment-proofs/:id/url` returns a 5-minute signed link, shown inline. Each view is audited.
  - **Accept:** marks the order PAID and confirms a pending one; duplicate uploads are closed.
  - **Reject:** the reason is shown to the customer. With no other screenshot pending, payment becomes FAILED and the customer can upload again.
  - **Mismatch:** `amountMismatch` flags a stated amount that differs from the order total.
- **Search:** `q` matches an order number (any spelling), a phone (any spelling) or part of a name (trigram index). Dates are filtered in Pakistan time.
- **Jobs** (`src/jobs`, off with `JOBS_ENABLED=false`, which the tests use):
  - **Scheduler:** in-process with jitter; a Redis lock means one instance runs each tick. If Redis is down every instance runs, which is safe because the jobs are idempotent and use row locks.
  - `cancel-unpaid-transfers`, every 5 minutes: transfer orders unpaid after `TRANSFER_PAYMENT_WINDOW_HOURS` are cancelled as SYSTEM, which frees their stock. Orders with a screenshot awaiting review are skipped, re-checked under the row lock.
  - `cleanup-auth`, hourly: deletes OTP challenges older than a day, sessions that ended more than 30 days ago, and expired stock holds, in 5,000-row batches.
- **To do:** customer notifications (WhatsApp/SMS on confirm, ship and reject); partial refunds.

## Staff catalog: images, products, stock & taxonomy

- **Images** (`modules/media`, `media.write`):
  - **Checks:** the upload must be JPG, PNG or WEBP by its magic bytes, at most 20 MB and at least 64 px. Anything over ~50 MP is refused before decoding.
  - **Processing** (`image-processing.ts`, at most two at a time per instance):
    - applies the EXIF rotation, converts to sRGB and drops all metadata (GPS, camera serials);
    - re-encodes as WebP: the full image fits in 2560 px, plus 320/640/960/1280/1920 px copies smaller than it.
  - **Storage:** keys are `media/<uuidv7>/full.webp` and `…/w640.webp` in `S3_PUBLIC_BUCKET`, cached `immutable`.
  - **Duplicates:** uploading the same file again returns the existing image (200).
  - **Deleting** is refused while the image is used (409 `MEDIA_IN_USE`, with where it is used).
  - **Dev:** seed images are still served by the storefront (`/images/*`). Uploads (`/media/*`) need the web app's `/media` proxy to the bucket (B8).
- **Products** (`catalog/admin`, `catalog.write`):
  - **Create:** a product and its variants in one transaction, together with categories, tags (created on the fly), attributes and the gallery (images can be pinned to a variant by SKU).
  - **Slug:** generated from the name when omitted (`-2`, `-3` if taken). It never changes when the name does.
  - **Validation rules** (`product-validation.ts`, pure and unit-tested):
    - Attributes must match their type: SELECT takes one value, MULTI_SELECT one or more, and TEXT, NUMBER and BOOLEAN their own type.
    - Variants are told apart by the same variant-scope options, and no two may share a combination.
    - A product can only be ACTIVE with an active variant.
    - Errors come back as 422 with a `path` per field.
  - **Edit:** `PATCH` needs the `updatedAt` from the last read; if someone saved in between it returns 409 `STALE_UPDATE`. List fields replace the whole list. Variant changes also bump `updatedAt`, and every write returns the full product.
  - **Deleting:** only never-ordered products or variants can be deleted (otherwise `PRODUCT_HAS_ORDERS` / `VARIANT_HAS_ORDERS`: archive or deactivate instead), and never while stock is reserved.
- **Stock** (`inventory.write`):
  - **Adjustments:** `add` (±) or `set` per line, applied all-or-nothing. Rows are locked in variant-id order (like checkout). Every change gets a movement (reason, note, who) and an audit entry.
  - **Limits:** stock never drops below units reserved by open orders, unless backorders are on. Backorders can't be turned off while they're in use.
  - **List:** filters `stock=low|out|backorder`, SKU or name search; plus per-variant history.
- **Categories** (`admin-categories.service.ts`):
  - **Tree data:** `path` and `depth` are maintained by the API (at most 11 levels, as the DB check allows).
  - **Moving** (`parentId`): rewrites the whole subtree in one statement. Moving a category inside itself is refused.
  - **Serialised:** tree changes take an advisory lock, so two moves can't race into a cycle.
  - **Reorder:** takes every child of the parent, exactly once.
  - **Delete:** refused while the category has subcategories or is a product's main category.
  - **Banner:** `focus` is validated as a CSS position (`50% 30%`).
- **Attributes** (`admin-attributes.service.ts`):
  - **Fixed after creation:** `code` and value slugs are part of filter URLs (`?f.fabric=lawn`). They're generated from the name or label if omitted.
  - **Type and scope** can change only while nothing uses the attribute. Variant options must be SELECT (also a DB check).
  - **Deleting** an attribute or value that's in use is refused, with counts.
- **Brands:** the same pattern; deleting a brand that products use is refused.
- **Collections** (`admin-collections.service.ts`):
  - **Hand-picked:** `PUT …/products` sets the list in order.
  - **Automated:** rules are checked against the catalog (attribute codes, values and tags must exist). `POST /admin/collections/preview` shows the count and sample before saving.
  - **Switching** a collection to automated clears its hand-picked list.
  - **`state`:** `live`, `scheduled`, `ended` or `hidden`, using the same rule as the storefront.
- **Edit rules for all of the above:**
  - `PATCH` needs `updatedAt` (409 `STALE_UPDATE` if someone saved in between).
  - Every write is audited and refreshes the storefront cache.
  - Slug, code and swatch formats are also enforced by DB checks (migration `taxonomy_checks`).
- **Known:** Prisma 7.10's pg adapter sometimes overlaps queries inside a transaction. pg 8 queues them and logs a deprecation warning. Keep `pg` on 8.x until Prisma fixes it.
- **Caching:** every write refreshes the storefront cache after commit. Listing prices and stock flags are kept up to date by the existing database triggers.
- **Docker:** sharp's musl bindings (libvips) are copied into the image, and the build fails if sharp doesn't load.

## Staff discounts, content & settings

- **Discounts** (`orders/admin/admin-discounts.*`, `discounts.write`; reading also allowed with `orders.read`):
  - **Codes:** stored upper-case; checkout matches them case-insensitively.
  - **Values per type:** PERCENTAGE in basis points (1–10000), FIXED_AMOUNT in paisa, FREE_SHIPPING 0. A cap is allowed only on percentages.
  - **Used codes:** can't be renamed, can't have their usage limit set below what's already been used, and can't be deleted (deactivate them instead).
  - **Edits** affect future checkouts only; orders keep their own amounts.
  - **`state`:** active, scheduled, expired, used-up or inactive. Filtered in SQL, comparing `usage_count` with `usage_limit` via a field reference.
  - **Detail:** includes orders, discount given and revenue.
- **Pages** (`content/admin`, `content.write`):
  - **Sections:** `settings` are validated with the same `SECTION_SCHEMAS` the storefront parses with, and stored as parsed. Errors point at `settings.<field>`.
  - **Section editing:** insert at any position, reorder, hide, schedule. Deleted sections' settings stay in the audit log.
  - **Admin view:** shows every section with `valid` and `live` flags.
  - **Protected:** `home` can't be unpublished, moved or deleted.
- **Menus:** `PUT /admin/menus/:key` creates the menu or replaces its whole tree (at most 3 levels and 300 items, safe links only). `main`, `shop-mega`, `footer` and `mobile` can't be deleted.
- **Settings** (`settings.write`):
  - **Keys:** every key in `PUBLIC_SETTINGS`, each validated by its schema and stored stripped of unknown fields.
  - **Saving** refreshes the settings cache, so checkout charges a new delivery fee immediately.
  - **Audit:** records before and after values, plus who saved.
- **Concurrency:** every edit needs `updatedAt` (null when creating a menu or setting); someone else's newer save gives 409 `STALE_UPDATE`.

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
