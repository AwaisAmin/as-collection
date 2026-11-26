import { type NextRequest, NextResponse } from 'next/server';

/**
 * Fast redirect to sign-in when there is no session cookie at all. The real check (is the
 * session valid, which permissions) happens on the server for every page and API call.
 */
const SESSION_COOKIES = ['as_admin', '__Host-as_admin'];

/** The page being opened, read by `requireStaff` (lib/session.ts) when the session has ended. */
const PATH_HEADER = 'x-admin-path';

export function proxy(request: NextRequest) {
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, next);
    return NextResponse.next({ request: { headers } });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (next !== '/') url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except sign-in, password change, Next.js assets and icons.
  matcher: ['/((?!login|change-password|_next/|favicon\.ico|icon|apple-icon).*)'],
};
