import type { SignedUrlDto } from '@as/contracts';
import { z } from 'zod';

import { ApiError, apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { getSessionToken, getStaff } from '@/lib/session';

/*
 * A customer's payment screenshot, streamed through the admin server. The browser never gets
 * the storage link (it would work for anyone for five minutes); every view is audited by the API.
 */

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Customer uploads are capped well below this by the API. */
const MAX_BYTES = 12 * 1024 * 1024;

const paramsSchema = z.object({
  number: z.string().regex(/^AS-\d{6}-[23456789A-HJKMNP-Z]{5}$/),
  proofId: z.uuid(),
});

const deny = (status: number) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(
  _request: Request,
  { params }: RouteContext<'/orders/[number]/proof/[proofId]'>,
): Promise<Response> {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return deny(404);
  const [session, token] = await Promise.all([getStaff(), getSessionToken()]);
  if (!session || !token) return deny(401);
  if (!can(session.permissions, 'payments.review')) return deny(403);

  let signed: SignedUrlDto;
  try {
    const { number, proofId } = parsed.data;
    signed = await apiRequest<SignedUrlDto>(
      `/admin/orders/${number}/payment-proofs/${proofId}/url`,
      { token },
    );
  } catch (error) {
    return deny(error instanceof ApiError && error.status === 404 ? 404 : 502);
  }

  const upstream = await fetch(signed.url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const type = upstream?.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const length = Number(upstream?.headers.get('content-length') ?? 0);
  if (!upstream?.ok || !upstream.body || !IMAGE_TYPES.has(type) || length > MAX_BYTES) {
    return deny(502);
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      ...(length ? { 'Content-Length': String(length) } : {}),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
