# @as/web — AS Collection Hub storefront

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4.

## Run

```bash
cp .env.example .env.local
pnpm --filter @as/web dev      # http://localhost:3000
```

## Structure

```
src/
  app/                 # routes, layouts, error/not-found boundaries, metadata routes
  config/              # env (zod-validated), site constants, navigation data
  components/
    ui/                # design-system primitives (Button, Divider, Icon…)
    layout/            # TopBar, Header, Footer — shared across routes
  features/<feature>/  # feature-scoped components, hooks, services (e.g. home, newsletter)
  hooks/               # shared reusable hooks
  lib/                 # framework-agnostic utilities (cn, errors, http client)
  types/               # shared app types
public/images/         # swappable image assets
```

Rules of thumb: features never import from other features; shared code moves to `components/` or `lib/`.
