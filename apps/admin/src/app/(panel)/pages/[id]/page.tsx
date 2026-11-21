import type { AdminCategoryNodeDto, AdminCollectionDto, AdminPageDto } from '@as/contracts';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { env } from '@/config/env';
import { flatten } from '@/features/categories/tree';
import { PageDetails } from '@/features/pages/components/page-details';
import { SectionList } from '@/features/pages/components/section-list';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit page' };

export default async function PageEditorPage({ params }: PageProps<'/pages/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'content.write')) {
    return <Alert tone="error">Your role does not include shop content.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [page, tree, collections] = await Promise.all([
    apiFindOrNull<AdminPageDto>(`/admin/pages/${id}`, { token }),
    // Names for categories / collections; the page still works if these fail.
    apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }).catch(() => []),
    apiRequest<AdminCollectionDto[]>('/admin/collections', { token }).catch(() => []),
  ]);
  if (!page) notFound();
  const lookups = {
    categories: flatten(tree).map((c) => ({
      value: c.slug,
      label: `${'— '.repeat(c.depth)}${c.name}${c.isActive ? '' : ' (hidden)'}`,
    })),
    collections: collections.map((c) => ({
      value: c.slug,
      label: `${c.name}${c.state === 'live' ? '' : ` (${c.state})`}`,
    })),
  };
  const shopUrl = new URL(page.slug === 'home' ? '/' : `/${page.slug}`, env.STOREFRONT_URL).href;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/pages"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Pages
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold">{page.title}</h1>
            <p className="text-[14px] text-muted">
              Sections from top to bottom. Changes show in the shop within a moment.
            </p>
          </div>
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-[14px] text-gold-dark hover:underline"
          >
            View in the shop
            <ExternalLink aria-hidden size={14} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionList
          // Fresh state after every change (sections carry their own versions).
          key={page.updatedAt}
          pageId={page.id}
          sections={page.sections}
          lookups={lookups}
          canWrite
        />
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[16px] font-semibold">Page details</h2>
          <PageDetails key={page.updatedAt} page={page} canWrite />
        </Card>
      </div>
    </div>
  );
}
