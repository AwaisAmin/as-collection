import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { ProductEditor } from '@/features/products/components/product-editor';
import { loadEditorData } from '@/features/products/editor-data';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.write')) {
    return <Alert tone="error">Your role cannot add products.</Alert>;
  }
  const data = await loadEditorData(token);

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
        <h1 className="text-[22px] font-semibold">New product</h1>
      </div>
      {data ? (
        <ProductEditor
          product={null}
          {...data}
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
