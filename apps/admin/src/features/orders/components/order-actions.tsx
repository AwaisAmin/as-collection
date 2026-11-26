'use client';

import type { StaffOrderAction } from '@as/contracts';
import { useId } from 'react';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { orderTransition } from '../actions';
import { ACTIONS } from '../labels';

/** The next steps for this order (only those the API allows and the staff member may take). */
export function OrderActions({
  number,
  actions,
  delivery,
  paid,
}: {
  number: string;
  actions: readonly StaffOrderAction[];
  delivery: { courier: string | null; trackingNumber: string | null };
  /** The customer's money is already in: cancelling means paying it back. */
  paid: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {actions.map((key) => {
        const meta = ACTIONS[key];
        // Forward steps first and prominent; cancelling / returns / refunds stay secondary.
        return (
          <ActionDialog
            key={key}
            trigger={meta.label}
            triggerVariant={meta.danger ? 'secondary' : 'primary'}
            title={`${meta.label} · ${number}`}
            description={
              key === 'cancel' && paid
                ? `${meta.description} The customer has already paid: send the money back, then use “Record refund”.`
                : meta.description
            }
            submitLabel={meta.label}
            submitVariant={meta.danger ? 'danger' : 'primary'}
            action={orderTransition.bind(null, number, key)}
          >
            {(errors) => <ActionFields action={key} errors={errors} delivery={delivery} />}
          </ActionDialog>
        );
      })}
    </div>
  );
}

function ActionFields({
  action,
  errors,
  delivery,
}: {
  action: StaffOrderAction;
  errors: Record<string, string>;
  delivery: { courier: string | null; trackingNumber: string | null };
}) {
  const id = useId();
  const note = (
    <Field
      id={`${id}-note`}
      label="Internal note"
      hint="Optional. Only staff see it."
      error={errors.note}
    >
      {(control) => <Textarea {...control} name="note" maxLength={500} rows={2} />}
    </Field>
  );

  switch (action) {
    case 'ship':
      return (
        <>
          <Field id={`${id}-courier`} label="Courier" error={errors.courier} required>
            {(control) => (
              <Input
                {...control}
                name="courier"
                defaultValue={delivery.courier ?? ''}
                placeholder="TCS, Leopards, M&P…"
                maxLength={60}
                required
                autoFocus
              />
            )}
          </Field>
          <Field
            id={`${id}-tracking`}
            label="Tracking number"
            hint="Shown to the customer on their order page."
            error={errors.trackingNumber}
          >
            {(control) => (
              <Input
                {...control}
                name="trackingNumber"
                defaultValue={delivery.trackingNumber ?? ''}
                maxLength={64}
                autoComplete="off"
                className="font-mono"
              />
            )}
          </Field>
          {note}
        </>
      );
    case 'cancel':
      return (
        <Field
          id={`${id}-reason`}
          label="Reason"
          hint="For staff only (customer asked, unreachable, out of stock…)."
          error={errors.reason}
          required
        >
          {(control) => (
            <Textarea {...control} name="reason" maxLength={500} rows={2} required autoFocus />
          )}
        </Field>
      );
    case 'return':
      return (
        <>
          <Checkbox
            name="restock"
            defaultChecked
            label="Put the items back into stock"
            hint="Untick for damaged or unsellable items."
          />
          {note}
        </>
      );
    case 'refund':
      return (
        <>
          <Field
            id={`${id}-reference`}
            label="Transaction reference"
            hint="The bank or wallet transaction id of the refund."
            error={errors.reference}
          >
            {(control) => (
              <Input {...control} name="reference" maxLength={100} autoComplete="off" />
            )}
          </Field>
          {note}
        </>
      );
    default:
      return note;
  }
}
