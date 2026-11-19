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

Rules of thumb:

- Features are layered and may only import **downward**:
  `catalog` → `wishlist` / `cart` → `product` → `checkout` → `account`, with `shop` / `home` composing them at the top.
  Lower features expose slots (e.g. `ProductCard` `actions`) instead of importing upward.
- Data access goes through `features/*/services/*.service.ts` (a port + adapter). Today the adapters are
  mocks; the NestJS API adapters replace them without touching pages.
- Catalog reads are `'use cache'` scopes (`cacheLife('hours')`, tag `catalog`) — revalidate with `revalidateTag`.
- Pages that read `params` / `searchParams` render a static shell and stream the URL-dependent part inside `<Suspense>`.
- Shared, feature-agnostic UI lives in `components/ui`; utilities in `lib/`.
