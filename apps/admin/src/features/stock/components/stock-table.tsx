'use client';

import type { AdminStockItemDto } from '@as/contracts';
import { ClipboardList, History } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { startTransition, useActionState, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ActionState } from '@/lib/action-state';
import { cn } from '@/lib/utils/cn';

import { saveStockCounts } from '../actions';
import { MANUAL_REASONS, REASONS } from '../labels';
import { AdjustStockDialog, StockSettingsDialog } from './stock-dialogs';

function Available({ item }: { item: AdminStockItemDto }) {
  if (!item.trackInventory) return <span className="text-muted">Not tracked</span>;
  const tone =
    item.available <= 0
      ? 'text-danger'
      : item.available <= item.lowStockThreshold
        ? 'text-warning'
        : undefined;
  return <span className={cn('font-medium', tone)}>{item.available}</span>;
}

/**
 * Stock per variant. "Stock count" adds a count column for a stocktake: type what is on the
 * shelf (blank = unchanged) and save all counts at once; they are applied together or not at all.
 */
export function StockTable({
  items,
  canWrite,
}: {
  items: readonly AdminStockItemDto[];
  canWrite: boolean;
}) {
  const id = useId();
  const formId = `${id}-counts`;
  const form = useRef<HTMLFormElement>(null);
  const [counting, setCounting] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveStockCounts(prev, data);
    if (result.done) {
      toast.success(result.done);
      form.current?.reset();
      setCounting(false);
    }
    return result;
  }, {});
  const rowErrors = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-3">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            variant={counting ? 'ghost' : 'secondary'}
            size="sm"
            onClick={() => setCounting((on) => !on)}
            aria-pressed={counting}
          >
            <ClipboardList aria-hidden size={15} />
            {counting ? 'Close stock count' : 'Stock count'}
          </Button>
        </div>
      ) : null}

      <div className="border-line bg-surface shadow-card relative overflow-x-auto rounded-card border">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-line bg-canvas/60 border-b text-[12px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                Variant
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                On hand
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Held
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Available
              </th>
              {counting ? (
                <th scope="col" className="w-32 px-4 py-3">
                  Counted
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {items.map((item) => (
              <tr key={item.variantId} className={rowErrors[item.variantId] ? 'bg-danger/5' : ''}>
                <td className="px-4 py-3">
                  <Link
                    href={`/products/${item.product.id}` as Route}
                    className="font-medium hover:underline"
                  >
                    {item.product.name}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    <span className="font-mono">{item.sku}</span>
                    {item.title ? <span>· {item.title}</span> : null}
                    {!item.isActive || item.product.status !== 'ACTIVE' ? (
                      <Badge>Hidden</Badge>
                    ) : null}
                    {item.allowBackorder ? <Badge tone="gold">Backorders</Badge> : null}
                  </p>
                  {rowErrors[item.variantId] ? (
                    <p className="text-danger text-[13px]">{rowErrors[item.variantId]}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{item.onHand}</td>
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {item.reserved || '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <Available item={item} />
                </td>
                {counting ? (
                  <td className="px-4 py-2">
                    {item.trackInventory ? (
                      <>
                        <input
                          type="hidden"
                          form={formId}
                          name={`was.${item.variantId}`}
                          value={item.onHand}
                        />
                        <Input
                          form={formId}
                          name={`count.${item.variantId}`}
                          inputMode="numeric"
                          placeholder={String(item.onHand)}
                          aria-label={`Counted units of ${item.sku}`}
                          aria-invalid={rowErrors[item.variantId] ? true : undefined}
                          autoComplete="off"
                          className="h-9 tabular-nums"
                        />
                      </>
                    ) : null}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canWrite ? (
                      <>
                        <AdjustStockDialog item={item} />
                        <StockSettingsDialog item={item} />
                      </>
                    ) : null}
                    <Link
                      href={`/stock/${item.variantId}` as Route}
                      className="hover:bg-canvas inline-flex size-8 items-center justify-center rounded-lg text-muted hover:text-text"
                      title={`History of ${item.sku}`}
                    >
                      <History aria-hidden size={15} />
                      <span className="sr-only">History of {item.sku}</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {counting ? (
        <form
          ref={form}
          id={formId}
          // Submitted by hand so a refused count keeps what was typed.
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => action(data));
          }}
          noValidate
          className="border-line bg-surface shadow-card flex flex-col gap-3 rounded-card border p-4"
        >
          <p className="text-[14px]">
            Type the counted units of the rows above (leave a row empty to keep it). All counts are
            saved together, or none if one is refused.
          </p>
          {state.error && state.at ? <Alert tone="error">{state.error}</Alert> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5 sm:w-64">
              <span className="text-[13px] font-medium">Reason</span>
              <Select name="reason" defaultValue="ADJUSTMENT">
                {MANUAL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {REASONS[reason].label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium">Note</span>
              <Input name="note" maxLength={500} placeholder="Optional, e.g. monthly count" />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save counts'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
