import { env } from '@/config/env';
import { clientInfo } from '@/lib/api/client-ip';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

/*
 * Subscribers as CSV, streamed straight from the API (which audits the export and neutralises
 * spreadsheet formulas). Only staff who may see subscribers get it; never cached.
 */

const STATUSES = new Set(['SUBSCRIBED', 'UNSUBSCRIBED']);

export async function GET(request: Request): Promise<Response> {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'newsletter.read')) {
    return new Response('Your role does not include the newsletter.', { status: 403 });
  }
  const requested = new URL(request.url).searchParams.get('status') ?? 'SUBSCRIBED';
  const status = STATUSES.has(requested) ? requested : 'SUBSCRIBED';
  const { ip, userAgent } = await clientInfo();

  const upstream = await fetch(`${env.API_URL}/admin/newsletter/export.csv?status=${status}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/csv',
      ...(ip ? { 'X-Forwarded-For': ip } : {}),
      ...(userAgent ? { 'User-Agent': userAgent.slice(0, 512) } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return new Response('The export could not be made right now. Please try again.', {
      status: 502,
    });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        upstream.headers.get('Content-Disposition') ?? 'attachment; filename="subscribers.csv"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
