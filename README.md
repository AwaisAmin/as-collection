# AS Collection Hub

Monorepo for the AS Collection Hub e-commerce platform.

| Path                         | What                                            |
| ---------------------------- | ----------------------------------------------- |
| `apps/web`                   | Storefront — Next.js (App Router), TS, Tailwind |
| `apps/api`                   | Backend — NestJS (modular, REST, versioned)     |
| `packages/shared`            | Shared types & Zod schemas (web ⇄ api contract) |
| `packages/typescript-config` | Shared `tsconfig` presets                       |

## Requirements

- Node 20.18+ (24 recommended, see `.nvmrc`)
- pnpm 10+

## Scripts (run from root)

```bash
pnpm install        # install all workspaces
pnpm dev            # run web + api in parallel (Turborepo)
pnpm build          # build everything
pnpm lint           # lint all workspaces
pnpm typecheck      # type-check all workspaces
pnpm format         # prettier write
```

Run one app: `pnpm --filter web dev` / `pnpm --filter api dev`.

## Conventions

- Conventional Commits (enforced by commitlint + husky).
- Prettier formats staged files on commit (lint-staged).
