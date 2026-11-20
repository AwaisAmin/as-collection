import type { AdminAttributeDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { CollectionEditor } from '@/features/collections/components/collection-editor';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'New collection' };

export default async function NewCollectionPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.write')) {
    return <Alert tone="error">Your role cannot add collections.</Alert>;
  }
  const attributes = await apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }).catch(
    () => null,
  );
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
        <h1 className="text-[22px] font-semibold">New collection</h1>
      </div>
      {attributes ? (
        <CollectionEditor
          collection={null}
          attributes={attributes}
          canWrite
          canUpload={can(permissions, 'media.write')}
          shopUrl={null}
        />
      ) : (
        <Alert tone="error">The catalog could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
