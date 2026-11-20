import type { AdminMediaListDto } from '@as/contracts';
import { Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsNav } from '@/components/ui/tabs-nav';
import { MediaCard } from '@/features/media/components/media-card';
import { MediaUpload } from '@/features/media/components/media-upload';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Images' };

const PAGE_SIZE = 40;
const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const querySchema = z.object({
  q: z.preprocess(first, z.string().trim().min(1).max(100).optional().catch(undefined)),
  unused: z.preprocess(first, z.enum(['1']).optional().catch(undefined)),
  before: z.preprocess(first, z.uuid().optional().catch(undefined)),
});
type MediaQuery = z.infer<typeof querySchema>;

function href(query: MediaQuery, change: Partial<MediaQuery>): Route {
  const next = { ...query, before: undefined, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.unused) params.set('unused', '1');
  if (next.before) params.set('before', next.before);
  const search = params.toString();
  return (search ? `/media?${search}` : '/media') as Route;
}

export default async function MediaPage({ searchParams }: PageProps<'/media'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const query = querySchema.parse(await searchParams);
  const list = await apiRequest<AdminMediaListDto>('/admin/media', {
    token,
    query: {
      q: query.q,
      unused: query.unused ? 'true' : undefined,
      before: query.before,
      limit: PAGE_SIZE,
    },
  }).catch(() => null);
  const canWrite = can(permissions, 'media.write');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Images</h1>
          <p className="text-[14px] text-muted">
            Every photo in the shop. Uploads are optimised automatically (WebP, sized for phones and
            screens).
          </p>
        </div>
        {canWrite ? <MediaUpload /> : null}
      </div>

      <TabsNav
        label="Image views"
        tabs={[
          { href: href(query, { unused: undefined }), label: 'All', active: !query.unused },
          { href: href(query, { unused: '1' }), label: 'Unused', active: Boolean(query.unused) },
        ]}
      />

      <form action="/media" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {query.unused ? <input type="hidden" name="unused" value="1" /> : null}
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium">Search</span>
          <span className="relative">
            <Search
              aria-hidden
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Description"
              maxLength={100}
              className="pl-9"
            />
          </span>
        </label>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {!list ? (
        <Alert tone="error">Images could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {list.items.map((media) => (
              <li key={media.id}>
                <MediaCard media={media} canWrite={canWrite} />
              </li>
            ))}
          </ul>
          {list.nextCursor || query.before ? (
            <nav aria-label="Pages" className="flex justify-between gap-3 text-[14px]">
              {query.before ? (
                <Link href={href(query, {})} className="text-gold-dark hover:underline">
                  Newest
                </Link>
              ) : (
                <span />
              )}
              {list.nextCursor ? (
                <Link
                  href={href(query, { before: list.nextCursor })}
                  className="text-gold-dark hover:underline"
                  rel="next"
                >
                  Older images
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">
            {query.q || query.unused ? 'No images match' : 'No images yet'}
          </p>
          <p className="text-[14px] text-muted">
            {query.unused
              ? 'Every image is in use.'
              : query.q
                ? 'Try a different description.'
                : 'Upload photos to start.'}
          </p>
        </div>
      )}
    </div>
  );
}
