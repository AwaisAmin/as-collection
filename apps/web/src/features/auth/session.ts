import 'server-only';

import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { authService } from './services/auth.service';
import type { User } from './types';

export const SESSION_COOKIE = 'as_session';

/** Current user for this request (deduplicated across components via React `cache`). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Partial/runtime prefetching can prerender with request cookies; the session lookup
  // (expiry check uses the clock) must only ever run for the real request.
  await connection();
  return authService.getUserBySessionToken(token);
});

/** For protected pages: real session check (the proxy only checks cookie presence). */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}` as Route);
  return user;
}

/** Server Functions only — sets the httpOnly session cookie. */
export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await authService.createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Server Functions only — invalidates the session server-side and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await authService.deleteSession(token);
  store.delete(SESSION_COOKIE);
}
