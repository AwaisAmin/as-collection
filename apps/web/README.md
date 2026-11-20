# @as/web — AS Collection Hub storefront

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Zustand · Zod.

## Run

```bash
cp .env.example .env.local     # MOCK_API=true works offline (in-memory data, no API needed)
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

- **Data access** goes through `features/*/services/*.service.ts` (a port). Each port has an API adapter (`*.api.ts`)
  and an in-memory mock (`*.mock.ts`, `MOCK_API=true`); pages never know which one runs.
  - **Live on the API:**
    - **B8a:** catalog, filters, product pages, reviews (with store replies and votes), newsletter and contact.
    - **B8b:** phone-code and Google sign-in, profile, address book and signed-in devices.
  - **Still mocked (B8c):** cart, checkout and orders.
- **Sessions (backend-for-frontend):**
  - **Cookie:** the API's bearer token lives only in the HttpOnly `as_session` cookie (SameSite=Lax, Secure in
    production, 180 days). The API decides validity (it slides sessions, 30 days idle), so the browser's JS never sees the
    token.
  - **Account calls:** take the token, never a user id (`requireSession()`).
  - **Forwarded details:** sign-in forwards the shopper's IP and browser, so "Signed-in devices" names each device.
- **Google sign-in:** Google's own button, shown only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set (the API must list the same
  id in `GOOGLE_CLIENT_IDS`). The ID token goes to the API, which verifies it. With `MOCK_API=true` a demo button signs in a
  demo customer.
- **API client** (`lib/api/http-client.ts`): server-only, typed with `@as/contracts` (the API's response types,
  shared). Errors arrive as RFC 9457 problems mapped to `ApiError` (`code`, `fieldErrors`). The shopper's IP is
  forwarded (`X-Forwarded-For`) so the API's per-IP limits apply to them, not to this server.
- **Mapping** (`features/catalog/services/api-mappers.ts`, unit-tested): paisa → whole rupees; attribute codes and value
  slugs → the names and labels shoppers see (filter URLs keep labels, e.g. `?shade=Ruby Red`); collections →
  occasions; own-site image URLs → paths.
- **Images:** uploads live in the API's public bucket. In development `/media/*` is proxied to `MEDIA_BUCKET_URL`; in
  production list the CDN in `MEDIA_REMOTE_HOSTS` so next/image can optimise from it.
- **Server is the source of truth**: checkout re-prices and re-checks stock server-side; client prices are never trusted.
- **Caching**: catalog/review reads are `'use cache'` (API: `cacheLife('minutes')`; tags `catalog`, `reviews`,
  `reviews:<slug>`). Instant refresh on admin edits (a revalidation webhook) comes with B8d.
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
