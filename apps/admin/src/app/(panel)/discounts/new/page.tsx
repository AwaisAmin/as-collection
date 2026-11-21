import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { DiscountForm } from '@/features/discounts/components/discount-form';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'New discount' };

export default async function NewDiscountPage() {
  const { permissions } = await requireStaff();
  if (!can(permissions, 'discounts.write')) {
    return <Alert tone="error">Your role cannot create discounts.</Alert>;
  }
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/discounts"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Discounts
        </Link>
        <h1 className="text-[22px] font-semibold">New discount</h1>
      </div>
      <DiscountForm discount={null} canWrite />
    </div>
  );
}
