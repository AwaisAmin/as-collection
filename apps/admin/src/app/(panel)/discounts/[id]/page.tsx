import type { AdminDiscountDetailDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DeleteDiscount } from '@/features/discounts/components/delete-discount';
import { DiscountForm } from '@/features/discounts/components/discount-form';
import {
  DISCOUNT_READ,
  DISCOUNT_STATES,
  discountSummary,
  usageText,
} from '@/features/discounts/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { formatMoney } from '@/lib/format';
import { can, canAny } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Discount' };

export default async function DiscountPage({ params, searchParams }: PageProps<'/discounts/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!canAny(permissions, DISCOUNT_READ)) {
    return <Alert tone="error">Your role does not include discounts.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [discount, query] = await Promise.all([
    apiFindOrNull<AdminDiscountDetailDto>(`/admin/discounts/${id}`, { token }),
    searchParams,
  ]);
  if (!discount) notFound();
  const state = DISCOUNT_STATES[discount.state];
  const canWrite = can(permissions, 'discounts.write');

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
        <div className="flex flex-col gap-1.5">
          <h1 className="font-mono text-[22px] font-semibold">{discount.code}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <Badge tone={state.tone}>{state.label}</Badge>
            <span>{discountSummary(discount)}</span>
            <span>· {usageText(discount)}</span>
          </div>
        </div>
      </div>
      {query.created === '1' ? <Alert tone="success">Discount created.</Alert> : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Orders with the code', String(discount.stats.orders)],
          ['Discount given', formatMoney(discount.stats.discountGivenMinor)],
          ['Revenue from those orders', formatMoney(discount.stats.revenueMinor)],
        ].map(([label, value]) => (
          <Card key={label} className="flex flex-col gap-0.5 p-4">
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="text-[22px] font-semibold tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>
      <p className="-mt-2 text-[13px] text-muted">Cancelled orders are not counted.</p>

      {/* Remounts after every save so the form starts from what was stored. */}
      <DiscountForm key={discount.updatedAt} discount={discount} canWrite={canWrite} />
      {canWrite ? <DeleteDiscount discount={discount} /> : null}
    </div>
  );
}
