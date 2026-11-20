import { type NextRequest, NextResponse } from 'next/server';

/**
 * Fast redirect to sign-in when there is no session cookie at all. The real check (is the
 * session valid, which permissions) happens on the server for every page and API call.
 */
const SESSION_COOKIES = ['as_admin', '__Host-as_admin'];

export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== '/') url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except sign-in, password change, Next.js assets and icons.
  matcher: ['/((?!login|change-password|_next/|favicon\.ico|icon|apple-icon).*)'],
};
