import type { AdminCollectionDto } from '@as/contracts';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { CollectionList } from '@/features/collections/components/collection-list';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Collections' };

export default async function CollectionsPage({ searchParams }: PageProps<'/collections'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const [collections, params] = await Promise.all([
    apiRequest<AdminCollectionDto[]>('/admin/collections', { token }).catch(() => null),
    searchParams,
  ]);
  const canWrite = can(permissions, 'catalog.write');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Collections</h1>
          <p className="text-[14px] text-muted">
            Occasions and edits (Eid, Wedding, New in): hand-picked or by rules, with optional start
            and end times.
          </p>
        </div>
        {canWrite ? (
          <ButtonLink href="/collections/new">
            <Plus aria-hidden size={17} />
            New collection
          </ButtonLink>
        ) : null}
      </div>
      {params.deleted === '1' ? <Alert tone="success">The collection was deleted.</Alert> : null}
      {!collections ? (
        <Alert tone="error">Collections could not be loaded right now. Refresh to try again.</Alert>
      ) : collections.length ? (
        <CollectionList collections={collections} canWrite={canWrite} />
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No collections yet</p>
          <p className="text-[14px] text-muted">Group products for an occasion or a season.</p>
        </div>
      )}
    </div>
  );
}
