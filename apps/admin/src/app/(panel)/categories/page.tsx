import type { AdminCategoryNodeDto } from '@as/contracts';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { CategoryTree } from '@/features/categories/components/category-tree';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage({ searchParams }: PageProps<'/categories'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const [tree, params] = await Promise.all([
    apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }).catch(() => null),
    searchParams,
  ]);
  const canWrite = can(permissions, 'catalog.write');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Categories</h1>
          <p className="text-[14px] text-muted">
            How the shop is organised. The order here is the order in menus and pages.
          </p>
        </div>
        {canWrite ? (
          <ButtonLink href="/categories/new">
            <Plus aria-hidden size={17} />
            New category
          </ButtonLink>
        ) : null}
      </div>
      {params.deleted === '1' ? <Alert tone="success">The category was deleted.</Alert> : null}
      {tree ? (
        <CategoryTree tree={tree} canWrite={canWrite} />
      ) : (
        <Alert tone="error">Categories could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
