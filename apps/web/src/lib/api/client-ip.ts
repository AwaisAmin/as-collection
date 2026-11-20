import 'server-only';

import { headers } from 'next/headers';

/**
 * The shopper's IP as seen by this server (first X-Forwarded-For hop set by the hosting proxy),
 * forwarded to the API for its per-IP abuse limits. Only call from requests (actions, routes).
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || h.get('x-real-ip') || null;
}

/** IP and browser of the shopper, for sign-in (the API lists sessions by device). */
export async function clientInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  return { ip: await clientIp(), userAgent: (await headers()).get('user-agent') };
}
