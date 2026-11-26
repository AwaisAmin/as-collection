# @as/e2e — browser tests across the storefront, the admin panel and the API

Playwright drives production builds of `apps/web` and `apps/admin` against a real `apps/api`,
PostgreSQL, Redis and storage, on the seeded catalog. It covers browsing (desktop and mobile), guest
checkout (place → track → cancel, with stock held and released; discount codes refused with a reason, applied, saved on the order), phone-code sign-in with the
account pages, the contact and newsletter forms, and the admin panel: staff sign-in (password +
first-time authenticator setup → dashboard → sign out) and order handling (a bank-transfer order
with a payment screenshot is verified, shipped and delivered; stock moves from reserved to sold) and
products (create with an uploaded photo and two sizes, publish, edit a variant, delete), stock
(receive, refused removal, stock count, history, alert level) and the image library (upload,
describe, delete), categories (create with a picture and filter, subcategory — both get shop pages linked to each other — reorder, move, delete)
brands (add, hide, delete), attributes (values, swatch, reorder, settings, delete) and collections
(automatic with preview, hand-picked with products and a schedule, reorder, delete) and discount
codes (create, applied by the real checkout quote, changed, switched off, deleted) and the home page
editor (add a carousel, rejected link, move, hide, remove; a shop-the-look dot placed by clicking the
photo, the sale banner, an uploaded Instagram post; every home section's settings are restored) and
store settings (a new delivery fee charged by the real checkout quote, derived contact links, a
refused announcement link, payment accounts confirmed; all settings restored) and menus (a footer
link refused, added, moved and saved into the shop's menu, then hidden; header items nested and
undone; the footer saved back as it was) and reviews (published into the product rating, answered,
shown on the home page, unpublished; spam rejected with a reason and deleted; test reviews
removed) and the inbox and newsletter (a message read on opening, noted, archived, restored, marked
unread; subscribers listed by status and downloaded as CSV, the export audited) and customers (found by a local mobile number, details and note saved, a
conflicting edit refused, blocked with every device signed out, unblocked) and staff and roles (role created, member added
with it, password reset, access off and on, role in use not deletable, removed and deleted; own
access read-only) and the activity log (sign-in and a role change shown, filtered by person and
area, linked to the record and its history). Stock,
category and collection tests restore what they change.

```bash
pnpm services:up                                  # Docker: PostgreSQL, Redis, storage
pnpm --filter @as/api db:deploy && pnpm --filter @as/api db:seed
pnpm --filter @as/api build
pnpm --filter @as/e2e install-browsers            # once: Chromium for Playwright
pnpm --filter @as/e2e test:browser                # starts the API (4100), builds + starts web (3100) and admin (3101)
E2E_SKIP_WEB_BUILD=1 pnpm --filter @as/e2e test:browser   # reuse the last web and admin builds
pnpm --filter @as/e2e test:browser --project=admin        # only the admin panel
```

- **Data:** test customers and orders use 0396… phone numbers and `@e2e-browser.example.test` emails. Every
  test removes its own data, releases any stock it held and reverses stock its orders sold (`tests/db.ts`).
- **Login codes:** the API runs with `OTP_DEV_ECHO=true` (refused in production), so the storefront shows the
  code in a toast and the test reads it.
- **Staff:** admin tests create a super admin with the real `staff:create` CLI (`@e2e-admin.example.test`),
  compute the authenticator code from the key shown on the setup screen (RFC 6238, `tests/admin/totp.ts`), and
  afterwards delete the account, its sessions and its audit entries (`tests/admin/staff-db.ts`). Uploaded test
  photos are unique generated PNGs (`tests/admin/png.ts`) and are deleted through the API, storage included.
- **Servers:** locally, already-running servers on 4100 / 3100 / 3101 are reused; CI always starts fresh ones.
