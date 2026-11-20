# AS Collection Hub

Monorepo for the AS Collection Hub e-commerce platform.

| Path                         | What                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `apps/web`                   | Storefront — Next.js 16 (App Router), TypeScript, Tailwind |
| `apps/api`                   | Backend — NestJS 12 (ESM, modular monolith, REST, `/v1`)   |
| `apps/admin`                 | Staff admin panel — Next.js 16, talks to `/v1/admin/*`     |
| `packages/contracts`         | Shared API types (storefront ↔ API)                        |
| `e2e`                        | Playwright browser tests (storefront, admin, API)          |
| `packages/typescript-config` | Shared `tsconfig` presets                                  |
| `compose.yaml`               | Local Postgres, Redis and S3-compatible storage            |

## Requirements

- Node 24 (see `.nvmrc`), pnpm 10+
- Docker (for the local database, cache and file storage)

## Getting started

```bash
pnpm install
cp .env.example .env                    # local service passwords (dev only)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm services:up                        # Postgres :5440 · Redis :6390 · storage :9000 (console :9001)
pnpm --filter @as/api db:deploy && pnpm --filter @as/api db:seed
pnpm dev                                # web :3000 · admin :3001 · api :4000
```

First administrator (password on stdin; two-step verification is set up at first sign-in):

```bash
STAFF_EMAIL=you@example.com STAFF_NAME="Your Name" pnpm --filter @as/api staff:create
```

## Scripts (run from root)

```bash
pnpm dev            # run web + admin + api (Turborepo)
pnpm build          # build everything
pnpm lint           # lint all workspaces
pnpm typecheck      # type-check all workspaces
pnpm test           # unit tests
pnpm test:e2e       # API end-to-end tests
pnpm format         # prettier write
pnpm services:up    # start local Docker services (waits until healthy)
pnpm services:down  # stop them (data kept; `docker compose down -v` deletes it)
```

Run one app: `pnpm --filter @as/web dev` / `pnpm --filter @as/admin dev` / `pnpm --filter @as/api dev`.
Browser tests: see [`e2e/README.md`](e2e/README.md).

## Conventions

- Conventional Commits (commitlint + husky); staged files are linted and formatted on commit.
- CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, unit + e2e tests, builds,
  and builds the API Docker image on every push and pull request.
