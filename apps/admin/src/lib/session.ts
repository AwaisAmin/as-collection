import 'server-only';

import type { Route } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { safeNextPath } from '@/features/auth/safe-next';

import { ApiError, apiRequest } from './api/http-client';

/*
 * Staff session (backend-for-frontend): the API's bearer token lives only in an HttpOnly,
 * SameSite=Strict cookie on the admin's own origin. In production the `__Host-` prefix also
 * pins it to HTTPS, this exact host and path `/`.
 */

export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-as_admin' : 'as_admin';

/** Upper bound only; the API ends idle sessions sooner (STAFF_SESSION_IDLE_MINUTES). */
const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface StaffSession {
  staff: {
    id: string;
    email: string;
    name: string;
    mustChangePassword: boolean;
    totpEnabled: boolean;
  };
  permissions: string[];
}

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in staff member for this request (deduplicated), or null. */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  await connection();
  try {
    return await apiRequest<StaffSession>('/admin/auth/session', { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

/**
 * Panel pages: a valid session whose password is not waiting to be changed. Returns the
 * session and its token (every admin API call needs it).
 */
export async function requireStaff(): Promise<StaffSession & { token: string }> {
  const session = await getStaff();
  const token = await getSessionToken();
  if (!session || !token) {
    // Session ended (idle, signed out elsewhere, access turned off): come back here afterwards.
    const next = safeNextPath((await headers()).get('x-admin-path'));
    redirect((next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`) as Route);
  }
  if (session.staff.mustChangePassword) redirect('/change-password' as Route);
  return { ...session, token };
}

/** Server Functions only. */
export async function startSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Server Functions only: ends the session at the API and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await apiRequest<void>('/admin/auth/logout', { method: 'POST', token }).catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}
