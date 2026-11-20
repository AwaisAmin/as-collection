import type { AdminAttributeDto, AdminCategoryDto, AdminCategoryNodeDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { env } from '@/config/env';
import { CategoryEditor } from '@/features/categories/components/category-editor';
import { pathOf } from '@/features/categories/tree';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit category' };

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<'/categories/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [category, data, query] = await Promise.all([
    apiFindOrNull<AdminCategoryDto>(`/admin/categories/${id}`, { token }),
    Promise.all([
      apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }),
      apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }),
    ]).catch(() => null),
    searchParams,
  ]);
  if (!category) notFound();
  const path = data ? pathOf(data[0], category.id) : [category.name];

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
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold">{category.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            {category.isActive ? <Badge tone="success">Shown</Badge> : <Badge>Hidden</Badge>}
            {path.length > 1 ? <span>{path.join(' › ')}</span> : <span>Top level</span>}
            <span>
              ·{' '}
              <Link href={`/products?category=${category.id}` as Route} className="hover:underline">
                {category.counts.products} {category.counts.products === 1 ? 'product' : 'products'}
              </Link>
            </span>
          </div>
        </div>
      </div>

      {query.created === '1' ? <Alert tone="success">Category created.</Alert> : null}

      {data ? (
        <CategoryEditor
          // Remounts after every save so the form starts from what was stored.
          key={category.updatedAt}
          category={category}
          parentId={null}
          tree={data[0]}
          attributes={data[1]}
          canWrite={can(permissions, 'catalog.write')}
          canUpload={can(permissions, 'media.write')}
          shopUrl={
            category.isActive ? new URL(`/shop/${category.slug}`, env.STOREFRONT_URL).href : null
          }
        />
      ) : (
        <Alert tone="error">The catalog could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
