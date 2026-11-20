# @as/admin — staff admin panel

Next.js 16 app for running the store. Every request goes server-side to the API's `/v1/admin/*`
endpoints (backend-for-frontend); the browser never sees the API or the staff token.

```bash
cp .env.example .env.local
pnpm --filter @as/admin dev          # http://localhost:3001 (the API must be running)
```

First administrator: `STAFF_EMAIL=… STAFF_NAME="…" pnpm --filter @as/api staff:create` (password
on stdin). Everyone else is added from the panel.

## Security

- **Sign-in:** work email + password, then a 6-digit authenticator code. The first sign-in sets up
  the authenticator (QR code, or the key typed in by hand). Accounts flagged by an administrator
  must change their password before anything else.
- **Session:** the API's opaque staff token lives in an HttpOnly, `SameSite=Strict` cookie
  (`__Host-as_admin` in production) for at most 12 hours. The API checks it on every request, so
  revoking a session or changing a role takes effect immediately.
- **Permissions:** the sidebar and dashboard only show what the staff member's roles allow; the
  API enforces the same permissions on every endpoint regardless.
- **Headers:** a CSP that forbids framing, plugins and posting forms elsewhere; `noindex`; no
  referrer sent to other sites.

## Areas

- **Orders** (`/orders`): work queues (to confirm, payments to check, to ship…), search by number,
  phone or name, filters by payment method and date. The order page shows the next allowed steps
  (confirm, pack, ship with courier + tracking, deliver, cancel, return, refund), transfer
  screenshots to accept or reject, and the timeline with internal or customer-visible notes.
  Screenshots are streamed through the admin (`/orders/[number]/proof/[id]`), never linked directly.
- **Products** (`/products`): list by status with search, category, low-stock filter and sorting.
  The editor covers basics, images (upload several at once or pick from the library; order, alt
  text, tie an image to a variant), variants, details (attributes, with the ones a category asks
  for shown first), specifications, SEO, status, categories, brand, tags and highlights. Saving
  sends the version that was loaded; if someone else saved meanwhile, nothing is overwritten.
  Variants of a saved product are edited one by one (paused while the form has unsaved changes);
  stock is shown but changed only on the Stock page.
- **Stock** (`/stock`): every variant's on-hand, held-by-orders and available units, with All /
  Low / Out of stock / Backorders views and search. Add, remove or set stock with a reason and an
  optional reference; alert level, tracking and backorders per variant; a stock-count mode saves
  many counted rows at once (all or nothing). `/stock/[variant]` shows the full history (sales
  link to their orders).
- **Categories** (`/categories`): the tree in shop order, moved up/down in place; subcategories
  added from their parent. The editor covers name, web address (`/shop/<slug>`), parent (moving a
  category moves its subcategories), description, visibility, picture, banner (image, small
  heading, text, which part stays in view on phones), the filters shown on the page (attributes,
  optionally required for products there) and search-engine text. Empty categories can be deleted.
- **Attributes** (`/attributes`): product details / shop filters and variant options. The editor
  sets name, use (product detail or variant option), type (one choice, several, text, number,
  yes/no), unit, filter and visibility; type and use lock once in use, and the filter code never
  changes. Values: add (one per line on create), rename, colour swatch, reorder, delete unused.
- **Collections** (`/collections`): occasions and edits in display order with live / scheduled /
  ended / hidden state. Hand-picked collections get a searchable product picker and ordering
  (saved as one list); automatic ones a rule builder (on sale, in stock, featured, tag, detail,
  price range, recently added; all or any) with a preview of what matches now. Start and end
  times are entered in Pakistan time.
- **Brands** (`/brands`): add and edit in dialogs (name, web address, description, logo, shown);
  brands without products can be deleted; the product count links to those products.
- **Images** (`/media`): the library, newest first, with an Unused view and search; upload several
  at once, edit descriptions, see where an image is used, delete unused ones.

## Conventions

- Response types come from `@as/contracts` (`admin/*`); the API's mappers are typed to them.
- Lists keep their state in the URL (GET forms), so filtered views can be shared and bookmarked.
- Forms that can fail keep what was typed: `ActionDialog` submits by hand, because a React form
  `action` resets every field after each attempt.
- JSON editors (product, category) share `SaveBar` / `StaleAlert` and the server helpers in
  `lib/api/admin-call.ts` (`adminCall`, `parsePayload`, `saveFailure`).
- The image picker never renders a `<form>`, so it can open inside other forms' dialogs.
- Errors inside a modal are shown in the modal (toasts sit behind it).
- Constants used by server pages live in plain modules (`labels.ts`), never in `'use client'` files
  (a server import of those gets a client reference, not the value).
- Horizontal scroll containers are `relative`, so screen-reader-only labels inside them can't
  widen the page on phones.

## Layout

- `src/app/(auth)` — sign-in and password change; `src/app/(panel)` — the signed-in panel
- `src/features/<area>` — server actions, components and helpers per admin area
- `src/components/ui` — the admin's own form controls, cards, alerts, badges
- `src/lib/session.ts` — cookie handling, `requireStaff()`; `src/lib/permissions.ts`;
  `src/lib/navigation.ts` — the sidebar, filtered by permission
- `src/proxy.ts` — sends visitors without a session cookie to `/login`

Tests: `pnpm --filter @as/admin test` (unit) and the `admin` project in [`e2e`](../../e2e).
