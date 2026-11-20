import 'server-only';

import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { authService } from './services/auth.service';
import type { NewSession, User } from './types';

/*
 * Backend-for-frontend session: the API's bearer token lives only in an HttpOnly cookie on this
 * site; browser JavaScript never sees it, and every API call is made by this server.
 */

export const SESSION_COOKIE = 'as_session';

/**
 * The cookie outlives an idle session on purpose: the API slides sessions (30 days of
 * inactivity) up to an absolute 180 days, and is the only judge of whether it is still valid.
 */
const COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/** The raw session token from the cookie (not validated). */
export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Current user for this request (deduplicated across components via React `cache`). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  // Partial/runtime prefetching can prerender with request cookies; the session lookup must
  // only ever run for the real request.
  await connection();
  return authService.getUser(token);
});

/** For protected pages: real session check (the proxy only checks cookie presence). */
export async function requireUser(returnTo: string): Promise<User> {
  return (await requireSession(returnTo)).user;
}

/** Protected pages that call the account API: the user and their session token. */
export async function requireSession(returnTo: string): Promise<{ user: User; token: string }> {
  const user = await getCurrentUser();
  const token = await getSessionToken();
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(returnTo)}` as Route);
  return { user, token };
}

/** Server Functions only — stores the new session's token in the HttpOnly cookie. */
export async function startSession(session: NewSession): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Server Functions only — ends the session at the API and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await authService.logout(token).catch(() => undefined);
  store.delete(SESSION_COOKIE);
}
