import type { AdminAttributeDto, AdminCollectionDetailDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { env } from '@/config/env';
import { CollectionEditor } from '@/features/collections/components/collection-editor';
import { COLLECTION_STATE } from '@/features/collections/labels';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit collection' };

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<'/collections/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [collection, attributes, query] = await Promise.all([
    apiFindOrNull<AdminCollectionDetailDto>(`/admin/collections/${id}`, { token }),
    apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }).catch(() => null),
    searchParams,
  ]);
  if (!collection) notFound();
  const state = COLLECTION_STATE[collection.state];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/collections"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Collections
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold">{collection.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <Badge tone={state.tone}>{state.label}</Badge>
            <span>
              {collection.type === 'MANUAL' ? 'Hand-picked' : 'Automatic'} ·{' '}
              {collection.productCount} {collection.productCount === 1 ? 'product' : 'products'}
            </span>
          </div>
        </div>
      </div>
      {query.created === '1' ? <Alert tone="success">Collection created.</Alert> : null}
      {attributes ? (
        <CollectionEditor
          // Remounts after every save so the form starts from what was stored.
          key={collection.updatedAt}
          collection={collection}
          attributes={attributes}
          canWrite={can(permissions, 'catalog.write')}
          canUpload={can(permissions, 'media.write')}
          shopUrl={
            collection.state === 'live'
              ? new URL(`/shop?occasion=${collection.slug}`, env.STOREFRONT_URL).href
              : null
          }
        />
      ) : (
        <Alert tone="error">The catalog could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
