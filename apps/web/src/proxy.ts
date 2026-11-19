import { type NextRequest, NextResponse } from 'next/server';

/** Must match `SESSION_COOKIE` in features/auth/session.ts (proxy can't import server-only code). */
const SESSION_COOKIE = 'as_session';

/**
 * Optimistic gate for account pages: no session cookie → straight to login (fast, no render).
 * Pages still verify the session for real; this is only a UX/perf shortcut.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/account/:path*'],
};
