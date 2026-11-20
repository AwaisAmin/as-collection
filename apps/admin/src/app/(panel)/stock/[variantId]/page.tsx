import type { AdminStockItemDto, StockMovementListDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { AdjustStockDialog, StockSettingsDialog } from '@/features/stock/components/stock-dialogs';
import { REASONS } from '@/features/stock/labels';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Stock history' };

const ORDER_NUMBER = /^AS-\d{6}-[23456789A-HJKMNP-Z]{5}$/;

export default async function StockHistoryPage({
  params,
  searchParams,
}: PageProps<'/stock/[variantId]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const { variantId } = await params;
  if (!z.uuid().safeParse(variantId).success) notFound();
  const before = z.uuid().safeParse((await searchParams).before);
  const [item, history] = await Promise.all([
    apiFindOrNull<AdminStockItemDto>(`/admin/inventory/${variantId}`, { token }),
    apiRequest<StockMovementListDto>(`/admin/inventory/${variantId}/movements`, {
      token,
      query: { limit: 50, before: before.success ? before.data : undefined },
    }).catch(() => null),
  ]);
  if (!item) notFound();
  const canWrite = can(permissions, 'inventory.write');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/stock"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Stock
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-mono text-[22px] font-semibold">{item.sku}</h1>
            <p className="text-[14px] text-muted">
              <Link href={`/products/${item.product.id}` as Route} className="hover:underline">
                {item.product.name}
              </Link>
              {item.title ? ` · ${item.title}` : ''}
            </p>
          </div>
          {canWrite ? (
            <div className="flex items-center gap-1">
              <AdjustStockDialog item={item} />
              <StockSettingsDialog item={item} />
            </div>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['On hand', item.onHand],
          ['Held by orders', item.reserved],
          ['Available', item.available],
          ['Alert at', item.lowStockThreshold],
        ].map(([label, value]) => (
          <Card key={label} className="flex flex-col gap-0.5 p-4">
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="text-[22px] font-semibold tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>
      {!item.trackInventory ? (
        <Alert>Stock is not tracked for this variant: it never runs out in the shop.</Alert>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[16px] font-semibold">History</h2>
        {!history ? (
          <Alert tone="error">The history could not be loaded right now.</Alert>
        ) : history.items.length ? (
          <ol className="divide-line flex flex-col divide-y">
            {history.items.map((movement) => (
              <li key={movement.id} className="flex items-start gap-4 py-3 first:pt-0">
                <span
                  className={cn(
                    'w-14 shrink-0 text-right text-[16px] font-semibold tabular-nums',
                    movement.delta > 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {movement.delta > 0 ? '+' : '−'}
                  {Math.abs(movement.delta)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 text-[14px]">
                  <p className="font-medium">{REASONS[movement.reason].label}</p>
                  {movement.reference ? (
                    <p className="text-muted">
                      {ORDER_NUMBER.test(movement.reference) ? (
                        <Link
                          href={`/orders/${movement.reference}` as Route}
                          className="font-mono hover:underline"
                        >
                          {movement.reference}
                        </Link>
                      ) : (
                        <span className="font-mono">{movement.reference}</span>
                      )}
                    </p>
                  ) : null}
                  {movement.note ? <p className="whitespace-pre-line">{movement.note}</p> : null}
                  <p className="text-[13px] text-muted">
                    {formatDateTime(movement.createdAt)} · {movement.by?.name ?? 'System'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] text-muted">No stock changes recorded yet.</p>
        )}
        {history?.nextCursor || before.success ? (
          <div className="flex gap-4 text-[14px]">
            {before.success ? (
              <Link
                href={`/stock/${variantId}` as Route}
                className="text-gold-dark hover:underline"
              >
                Newest
              </Link>
            ) : null}
            {history?.nextCursor ? (
              <Link
                href={`/stock/${variantId}?before=${history.nextCursor}` as Route}
                className="text-gold-dark hover:underline"
              >
                Older changes
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
