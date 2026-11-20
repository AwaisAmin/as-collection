import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('server-only', () => ({}));

const SECRET = 'r'.repeat(40);

async function loadRoute(secret: string | undefined) {
  vi.resetModules();
  vi.stubEnv('REVALIDATE_SECRET', secret ?? '');
  return import('./route');
}

const post = (body: unknown, secret?: string) =>
  new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-Revalidate-Secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
  });

  it('is disabled without a configured secret', async () => {
    const { POST } = await loadRoute(undefined);
    expect((await POST(post({ tags: ['catalog'] }, SECRET))).status).toBe(404);
  });

  it('refuses a wrong secret and unknown tags', async () => {
    const { POST } = await loadRoute(SECRET);
    expect((await POST(post({ tags: ['catalog'] }, 'wrong'))).status).toBe(401);
    expect((await POST(post({ tags: ['catalog'] }))).status).toBe(401);
    expect((await POST(post({ tags: ['everything'] }, SECRET))).status).toBe(422);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('expires the given tags at once', async () => {
    const { POST } = await loadRoute(SECRET);
    const res = await POST(post({ tags: ['catalog', 'settings', 'catalog'] }, SECRET));
    expect(res.status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ['catalog', { expire: 0 }],
      ['settings', { expire: 0 }],
    ]);
  });
});
