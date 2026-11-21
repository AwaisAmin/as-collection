import type { AdminPageListItemDto } from '@as/contracts';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api/http-client';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Pages' };

export default async function PagesPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'content.write')) {
    return <Alert tone="error">Your role does not include shop content.</Alert>;
  }
  const pages = await apiRequest<AdminPageListItemDto[]>('/admin/pages', { token }).catch(
    () => null,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Pages</h1>
        <p className="text-[14px] text-muted">
          The shop’s pages built from sections: what shows, in which order, and when.
        </p>
      </div>
      {!pages ? (
        <Alert tone="error">Pages could not be loaded right now. Refresh to try again.</Alert>
      ) : (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {pages.map((page) => (
            <li key={page.id} className="hover:bg-canvas/50 relative px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/pages/${page.id}` as Route}
                  className="font-medium after:absolute after:inset-0 hover:underline"
                >
                  {page.title}
                </Link>
                {page.status === 'PUBLISHED' ? (
                  <Badge tone="success">Published</Badge>
                ) : (
                  <Badge>Draft</Badge>
                )}
              </div>
              <p className="text-[13px] text-muted">
                /{page.slug === 'home' ? '' : page.slug} · {page.sections}{' '}
                {page.sections === 1 ? 'section' : 'sections'} · edited {formatDate(page.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
