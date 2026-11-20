import { createHash, timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { serverEnv } from '@/config/env.server';

/**
 * Called by the API after staff edits so the storefront shows them at once instead of after its
 * cache expires. Authenticated with a shared secret (constant-time compare); only known tags.
 */

/** Tags the storefront caches under (see each feature's services). */
const TAGS = ['catalog', 'content', 'settings', 'reviews'] as const;

const bodySchema = z.object({ tags: z.array(z.enum(TAGS)).min(1).max(TAGS.length) });

const digest = (value: string) => createHash('sha256').update(value).digest();

function authorised(header: string | null): boolean {
  const secret = serverEnv.REVALIDATE_SECRET;
  if (!secret || !header) return false;
  // Hashing first gives equal-length buffers, so the comparison never leaks the length.
  return timingSafeEqual(digest(header), digest(secret));
}

export async function POST(request: Request): Promise<Response> {
  if (!serverEnv.REVALIDATE_SECRET) return new Response(null, { status: 404 });
  if (!authorised(request.headers.get('x-revalidate-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 422 });

  const tags = [...new Set(parsed.data.tags)];
  // Expire now: the next visitor gets fresh data (no stale-while-revalidate for admin edits).
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
