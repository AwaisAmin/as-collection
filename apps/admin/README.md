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

## Layout

- `src/app/(auth)` — sign-in and password change; `src/app/(panel)` — the signed-in panel
- `src/features/<area>` — server actions, components and helpers per admin area
- `src/components/ui` — the admin's own form controls, cards, alerts, badges
- `src/lib/session.ts` — cookie handling, `requireStaff()`; `src/lib/permissions.ts`;
  `src/lib/navigation.ts` — the sidebar, filtered by permission
- `src/proxy.ts` — sends visitors without a session cookie to `/login`

Tests: `pnpm --filter @as/admin test` (unit) and the `admin` project in [`e2e`](../../e2e).
