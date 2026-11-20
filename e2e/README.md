# @as/e2e — browser tests across the storefront and the API

Playwright drives a production build of `apps/web` against a real `apps/api`, PostgreSQL, Redis
and storage, on the seeded catalog. It covers browsing (desktop and mobile), guest checkout
(place → track → cancel, with stock held and released), phone-code sign-in with the account
pages, and the contact and newsletter forms.

```bash
pnpm services:up                                  # Docker: PostgreSQL, Redis, storage
pnpm --filter @as/api db:deploy && pnpm --filter @as/api db:seed
pnpm --filter @as/api build
pnpm --filter @as/e2e install-browsers            # once: Chromium for Playwright
pnpm --filter @as/e2e test:browser                # starts the API (4100), builds + starts the web (3100)
E2E_SKIP_WEB_BUILD=1 pnpm --filter @as/e2e test:browser   # reuse the last storefront build
```

- **Data:** test customers and orders use 0396… phone numbers and `@e2e-browser.example.test` emails. Every
  test removes its own data and releases any stock it held (`tests/db.ts`).
- **Login codes:** the API runs with `OTP_DEV_ECHO=true` (refused in production), so the storefront shows the
  code in a toast and the test reads it.
- **Servers:** locally, already-running servers on 4100 / 3100 are reused; CI always starts fresh ones.
