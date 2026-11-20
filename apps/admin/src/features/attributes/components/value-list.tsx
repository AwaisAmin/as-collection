'use client';

import type { AdminAttributeDto } from '@as/contracts';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { deleteValue, saveValue, swapValues } from '../actions';
import { SwatchInput } from './swatch-input';

type Value = AdminAttributeDto['values'][number];

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

function ValueFields({ value, errors }: { value: Value | null; errors: Record<string, string> }) {
  const id = useId();
  return (
    <>
      <Field id={`${id}-label`} label="Label" error={errors.label} required>
        {(control) => (
          <Input {...control} name="label" defaultValue={value?.label} maxLength={120} autoFocus />
        )}
      </Field>
      {value ? null : (
        <Field
          id={`${id}-value`}
          label="Link code"
          hint="Optional: made from the label. Used in filter links; it can’t change later."
          error={errors.value}
        >
          {(control) => (
            <Input
              {...control}
              name="value"
              maxLength={80}
              autoComplete="off"
              className="font-mono"
            />
          )}
        </Field>
      )}
      <Field
        id={`${id}-swatch`}
        label="Swatch colour"
        hint="Shown as a colour dot in filters and on products."
        error={errors.swatch}
      >
        {(control) => (
          <SwatchInput
            id={control.id}
            defaultValue={value?.swatch ?? null}
            invalid={Boolean(control['aria-invalid'])}
            {...(control['aria-describedby'] ? { describedBy: control['aria-describedby'] } : {})}
          />
        )}
      </Field>
    </>
  );
}

/** The values of a choice attribute: order, labels, swatches; unused ones can be deleted. */
export function ValueList({
  attribute,
  canWrite,
}: {
  attribute: AdminAttributeDto;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const values = attribute.values.toSorted((a, b) => a.position - b.position);
  const run = (work: () => Promise<{ done?: string; error?: string }>) =>
    start(async () => {
      const result = await work();
      if (result.error) toast.error(result.error);
      // Deleting is worth confirming; reordering shows itself.
      else if (result.done && result.done !== 'Order saved.') toast.success(result.done);
    });

  return (
    <div className="flex flex-col gap-3">
      {values.length ? (
        <ul
          className="border-line divide-line flex flex-col divide-y rounded-lg border"
          aria-busy={pending}
        >
          {values.map((value, index) => (
            <li key={value.id} className="flex items-center gap-3 px-3 py-2">
              <span
                aria-hidden
                className="border-line size-5 shrink-0 rounded-full border"
                style={value.swatch ? { background: value.swatch } : undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{value.label}</p>
                <p className="text-[13px] text-muted">
                  <span className="font-mono">{value.value}</span> ·{' '}
                  {value.usage ? `used ${String(value.usage)}×` : 'unused'}
                </p>
              </div>
              {canWrite ? (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    className={iconButton}
                    disabled={pending || index === 0}
                    onClick={() => {
                      const other = values[index - 1];
                      if (other) run(() => swapValues(attribute.id, value, other));
                    }}
                    title="Move up"
                  >
                    <ArrowUp aria-hidden size={15} />
                    <span className="sr-only">Move {value.label} up</span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={pending || index === values.length - 1}
                    onClick={() => {
                      const other = values[index + 1];
                      if (other) run(() => swapValues(attribute.id, value, other));
                    }}
                    title="Move down"
                  >
                    <ArrowDown aria-hidden size={15} />
                    <span className="sr-only">Move {value.label} down</span>
                  </button>
                  <ActionDialog
                    trigger={<Pencil aria-hidden size={15} />}
                    triggerLabel={`Edit ${value.label}`}
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerClassName="w-auto"
                    title={`Edit “${value.label}”`}
                    submitLabel="Save value"
                    action={saveValue.bind(null, attribute.id, value.id)}
                  >
                    {(errors) => <ValueFields value={value} errors={errors} />}
                  </ActionDialog>
                  {value.usage === 0 ? (
                    <button
                      type="button"
                      className={`${iconButton} hover:text-danger`}
                      disabled={pending}
                      onClick={() => run(() => deleteValue(attribute.id, value.id))}
                      title="Delete (unused)"
                    >
                      <Trash2 aria-hidden size={15} />
                      <span className="sr-only">Delete {value.label}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">No values yet.</p>
      )}
      {canWrite ? (
        <div>
          <ActionDialog
            trigger={
              <>
                <Plus aria-hidden size={16} />
                Add value
              </>
            }
            title={`Add a value to ${attribute.name}`}
            submitLabel="Add value"
            action={saveValue.bind(null, attribute.id, null)}
          >
            {(errors) => <ValueFields value={null} errors={errors} />}
          </ActionDialog>
        </div>
      ) : null}
    </div>
  );
}
