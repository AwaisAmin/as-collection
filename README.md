# AS Collection Hub

Monorepo for the AS Collection Hub e-commerce platform.

| Path                         | What                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `apps/web`                   | Storefront — Next.js 16 (App Router), TypeScript, Tailwind |
| `apps/api`                   | Backend — NestJS 12 (ESM, modular monolith, REST, `/v1`)   |
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
pnpm services:up                        # Postgres :5440 · Redis :6390 · storage :9000 (console :9001)
pnpm dev                                # web :3000 + api :4000
```

## Scripts (run from root)

```bash
pnpm dev            # run web + api (Turborepo)
pnpm build          # build everything
pnpm lint           # lint all workspaces
pnpm typecheck      # type-check all workspaces
pnpm test           # unit tests
pnpm test:e2e       # API end-to-end tests
pnpm format         # prettier write
pnpm services:up    # start local Docker services (waits until healthy)
pnpm services:down  # stop them (data kept; `docker compose down -v` deletes it)
```

Run one app: `pnpm --filter @as/web dev` / `pnpm --filter @as/api dev`.

## Conventions

- Conventional Commits (commitlint + husky); staged files are linted and formatted on commit.
- CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, unit + e2e tests, builds,
  and builds the API Docker image on every push and pull request.
