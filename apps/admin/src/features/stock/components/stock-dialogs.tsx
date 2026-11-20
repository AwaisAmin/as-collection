'use client';

import type { AdminStockItemDto } from '@as/contracts';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { adjustStock, saveStockSettings } from '../actions';
import { MANUAL_REASONS, REASONS } from '../labels';

const MODES = [
  { key: 'add', label: 'Add', reason: 'RESTOCK' },
  { key: 'remove', label: 'Remove', reason: 'DAMAGE' },
  { key: 'set', label: 'Set count', reason: 'ADJUSTMENT' },
] as const;

type Mode = (typeof MODES)[number]['key'];

function AdjustFields({
  item,
  errors,
}: {
  item: AdminStockItemDto;
  errors: Record<string, string>;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const n = /^\d+$/.test(amount.trim()) ? Number(amount) : null;
  const after =
    n === null ? null : mode === 'set' ? n : mode === 'add' ? item.onHand + n : item.onHand - n;

  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[13px] font-medium">Change</legend>
        <div className="border-line bg-canvas grid grid-cols-3 gap-1 rounded-lg border p-1">
          {MODES.map((m) => (
            <label
              key={m.key}
              className="has-checked:bg-surface has-checked:shadow-card flex cursor-pointer items-center justify-center rounded-md px-2 py-1.5 text-[14px] has-checked:font-medium has-focus-visible:outline-2"
            >
              <input
                type="radio"
                name="mode"
                value={m.key}
                checked={mode === m.key}
                onChange={() => setMode(m.key)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        id={`${id}-amount`}
        label={mode === 'set' ? 'Units on the shelf' : 'Units'}
        hint={
          after === null
            ? `Now ${String(item.onHand)} in stock${item.reserved ? `, ${String(item.reserved)} held by orders` : ''}.`
            : `${String(item.onHand)} → ${String(after)} in stock.`
        }
        error={errors.amount}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        )}
      </Field>
      <Field id={`${id}-reason`} label="Reason" error={errors.reason} required>
        {(control) => (
          <Select
            {...control}
            name="reason"
            key={mode}
            defaultValue={MODES.find((m) => m.key === mode)?.reason}
          >
            {MANUAL_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {REASONS[reason].label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id={`${id}-reference`} label="Reference" hint="Optional: invoice or delivery number.">
        {(control) => <Input {...control} name="reference" maxLength={100} autoComplete="off" />}
      </Field>
      <Field id={`${id}-note`} label="Note" hint="Optional.">
        {(control) => <Textarea {...control} name="note" rows={2} maxLength={500} />}
      </Field>
    </>
  );
}

/** Add, remove or set the stock of one variant (ledgered with the reason). */
export function AdjustStockDialog({ item }: { item: AdminStockItemDto }) {
  return (
    <ActionDialog
      trigger="Adjust"
      triggerSize="sm"
      triggerClassName="w-auto"
      triggerLabel={`Adjust stock of ${item.sku}`}
      disabled={!item.trackInventory}
      title={`Adjust stock · ${item.sku}`}
      description={item.product.name}
      submitLabel="Save stock"
      action={adjustStock.bind(null, item.variantId)}
    >
      {(errors) => <AdjustFields item={item} errors={errors} />}
    </ActionDialog>
  );
}

/** Low-stock alert level, tracking and backorders of one variant. */
export function StockSettingsDialog({ item }: { item: AdminStockItemDto }) {
  const id = useId();
  return (
    <ActionDialog
      trigger={<SlidersHorizontal aria-hidden size={15} />}
      triggerVariant="ghost"
      triggerSize="sm"
      triggerClassName="w-auto"
      triggerLabel={`Stock settings of ${item.sku}`}
      title={`Stock settings · ${item.sku}`}
      description={item.product.name}
      submitLabel="Save settings"
      action={saveStockSettings.bind(null, item.variantId)}
    >
      {(errors) => (
        <>
          <Field
            id={`${id}-threshold`}
            label="Low-stock alert at"
            hint="Listed under Low stock at or below this many available units."
            error={errors.lowStockThreshold}
            required
          >
            {(control) => (
              <Input
                {...control}
                name="lowStockThreshold"
                inputMode="numeric"
                defaultValue={item.lowStockThreshold}
              />
            )}
          </Field>
          <Checkbox
            name="trackInventory"
            defaultChecked={item.trackInventory}
            label="Track stock"
            hint="Untick for made-to-order items that never run out."
          />
          <Checkbox
            name="allowBackorder"
            defaultChecked={item.allowBackorder}
            label="Sell when out of stock"
            hint="Orders are taken and wait for new stock."
          />
        </>
      )}
    </ActionDialog>
  );
}
