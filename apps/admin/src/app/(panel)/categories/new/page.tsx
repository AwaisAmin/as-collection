import type { AdminAttributeDto, AdminCategoryNodeDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { CategoryEditor } from '@/features/categories/components/category-editor';
import { pathOf } from '@/features/categories/tree';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'New category' };

export default async function NewCategoryPage({ searchParams }: PageProps<'/categories/new'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.write')) {
    return <Alert tone="error">Your role cannot add categories.</Alert>;
  }
  const parent = z.uuid().safeParse((await searchParams).parent);
  const data = await Promise.all([
    apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }),
    apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }),
  ]).catch(() => null);
  const parentId =
    parent.success && data && pathOf(data[0], parent.data).length ? parent.data : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/categories"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Categories
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold">New category</h1>
          {data && parentId ? (
            <p className="text-[14px] text-muted">Inside {pathOf(data[0], parentId).join(' › ')}</p>
          ) : null}
        </div>
      </div>
      {data ? (
        <CategoryEditor
          category={null}
          parentId={parentId}
          tree={data[0]}
          attributes={data[1]}
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
