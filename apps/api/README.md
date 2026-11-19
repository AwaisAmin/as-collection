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

| Path                | What                                              |
| ------------------- | ------------------------------------------------- |
| `/api/v1/...`       | Versioned API (URI versioning)                    |
| `/api/health/live`  | Liveness — process is up (no dependencies)        |
| `/api/health/ready` | Readiness — dependencies healthy (load balancer)  |
| `/api/docs`         | Swagger UI + `/api/docs/json` (off in production) |

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
