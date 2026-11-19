# @as/web — AS Collection Hub storefront

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Zustand · Zod.

## Run

```bash
cp .env.example .env.local     # set MOCK_API=true until apps/api is running
pnpm --filter @as/web dev      # http://localhost:3000
pnpm --filter @as/web test     # unit tests (Vitest)
pnpm --filter @as/web build    # production build
```

## Pages

| Route                                                     | What                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/`                                                       | Home: hero, categories, trust bar, product carousels, sale, occasions, look, reviews |
| `/shop`, `/shop/[category]`, `/search`                    | Catalog with URL-driven filters, sort, pagination                                    |
| `/products/[slug]`                                        | Product page: gallery, variants, add to cart, size guide, tabs, reviews, related     |
| `/cart`, `/checkout`, `/order-confirmation/[orderNumber]` | Cart (stock re-validation), COD / bank transfer checkout, private confirmation       |
| `/login`, `/account/*`                                    | Phone OTP + Google sign-in; overview, orders, addresses, profile                     |
| `/wishlist`, `/track-order`                               | Saved products; order status by order number + phone                                 |
| `/about`, `/contact`, `/privacy-policy`, `/terms`         | Content pages (contact form + FAQ)                                                   |

## Structure

```
src/
  app/                 # routes, layouts, error/not-found boundaries, metadata routes, icons, OG image
  proxy.ts             # optimistic auth gate for /account/* (Next 16 "proxy", formerly middleware)
  config/              # env, site, navigation + mega menu, catalog, occasions, promotions, looks, instagram, payments
  components/
    ui/                # design-system primitives (Button, Input, Dialog, Drawer, Tabs, OtpInput…)
    layout/            # TopBar, Header (Shop mega menu), Footer, PageHeader, WhatsApp button
    shared/ seo/ routing/ ornaments/ motion/ brand/
  features/<feature>/  # components, hooks, services, actions, schemas per domain
  hooks/               # shared hooks (modal behaviour, focus trap, in-view, hydration…)
  lib/                 # framework-agnostic utilities (format, phone, http client, errors)
public/images/         # swappable image assets (same file names → no code changes)
```

### Feature layering (imports only go downward)

```
catalog → wishlist / cart / reviews → orders → product → checkout → auth/account → shop / home (composition)
```

Lower features expose slots (e.g. `ProductCard` `actions`) instead of importing upward.

## Conventions

- **Data access** goes through `features/*/services/*.service.ts` (a port + adapter). Adapters are **mocks** today
  (in-memory, kept on `globalThis` in dev); the NestJS API adapters replace them without touching pages.
- **Server is the source of truth**: checkout re-prices and re-checks stock server-side; client prices are never trusted.
- **Caching**: catalog/review reads are `'use cache'` (`cacheLife('hours')`, tags `catalog`, `reviews:<id>`).
  Stock/price checks for cart & checkout are deliberately uncached.
- **Rendering**: pages reading `params`/`searchParams`/cookies render a static shell and stream the request-time part
  inside `<Suspense>` (or `loading.tsx`). Session lookups call `connection()` so they never run during prerender.
- **Forms**: Server Actions + `useActionState`, one zod schema shared by client (instant feedback) and server,
  honeypot fields against bots, field errors wired with `aria-describedby` via `FormField`.
- **Accessibility**: WCAG 2.2 AA — audited with axe at 1280px and 375px on every page (0 violations).
  Gold text uses `text-gold-dark` (#8a5f22, ≥ 4.5:1 on cream); bright gold is for borders/ornaments only.

## Mocked until the backend step

| Area                        | Mock behaviour                         | Real implementation (apps/api)   |
| --------------------------- | -------------------------------------- | -------------------------------- |
| Catalog, reviews            | Static data in `features/catalog/data` | DB + admin panel                 |
| Orders, contact, newsletter | In-memory, lost on restart             | DB, staff notifications          |
| Payment screenshots         | Metadata only                          | Object storage (S3 / Cloudinary) |
| OTP login                   | Code shown in a dev toast              | WhatsApp → SMS fallback          |
| Google sign-in              | Demo account                           | OAuth 2.0                        |
| Recently viewed             | Browser only (`localStorage`)          | Optional sync to the account     |
