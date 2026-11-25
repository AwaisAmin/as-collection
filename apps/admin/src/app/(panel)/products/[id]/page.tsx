import type { AdminProductDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { env } from '@/config/env';
import { ProductEditor } from '@/features/products/components/product-editor';
import { loadEditorData } from '@/features/products/editor-data';
import { priceRange, PRODUCT_STATUS } from '@/features/products/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit product' };

export default async function ProductPage({ params, searchParams }: PageProps<'/products/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [product, data, query] = await Promise.all([
    apiFindOrNull<AdminProductDto>(`/admin/products/${id}`, { token }),
    loadEditorData(token),
    searchParams,
  ]);
  if (!product) notFound();
  const status = PRODUCT_STATUS[product.status];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/products"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Products
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="tabular-nums">
              {priceRange(product.summary.priceMinMinor, product.summary.priceMaxMinor)}
            </span>
            <span>
              · {product.summary.orders} {product.summary.orders === 1 ? 'order' : 'orders'} ·{' '}
              {can(permissions, 'reviews.moderate') ? (
                <Link
                  href={`/reviews?view=all&product=${product.id}`}
                  className="text-text underline-offset-4 hover:underline"
                >
                  {product.summary.reviews} {product.summary.reviews === 1 ? 'review' : 'reviews'}
                </Link>
              ) : (
                <>
                  {product.summary.reviews} {product.summary.reviews === 1 ? 'review' : 'reviews'}
                </>
              )}
            </span>
            <span>· edited {formatDateTime(product.updatedAt)}</span>
          </div>
        </div>
      </div>

      {query.created === '1' ? (
        <Alert tone="success">
          Product created.{' '}
          {product.status === 'DRAFT' ? 'It stays hidden until you set it to Active.' : ''}
        </Alert>
      ) : null}

      {data ? (
        // Remounts after every save so the form starts from what was stored.
        <ProductEditor
          key={product.updatedAt}
          product={product}
          {...data}
          canWrite={can(permissions, 'catalog.write')}
          canUpload={can(permissions, 'media.write')}
          shopUrl={
            product.status === 'ACTIVE'
              ? new URL(`/products/${product.slug}`, env.STOREFRONT_URL).href
              : null
          }
        />
      ) : (
        <Alert tone="error">The catalog could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
