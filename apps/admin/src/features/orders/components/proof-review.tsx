'use client';

import { useId } from 'react';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { reviewPaymentProof } from '../actions';
import { ActionDialog } from './action-dialog';

/** Accept (order becomes paid, a new order is confirmed) or reject with a reason for the customer. */
export function ProofReview({ number, proofId }: { number: string; proofId: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
      <ActionDialog
        trigger="Accept payment"
        triggerVariant="primary"
        title="Accept payment"
        description="The money is in the account. The order is marked paid and, if new, confirmed."
        submitLabel="Accept payment"
        action={reviewPaymentProof.bind(null, number, proofId, 'accept')}
      >
        {(errors) => (
          <Field
            id={`${id}-note`}
            label="Internal note"
            hint="Optional, e.g. the bank's transaction id."
            error={errors.note}
          >
            {(control) => <Textarea {...control} name="note" maxLength={500} rows={2} />}
          </Field>
        )}
      </ActionDialog>
      <ActionDialog
        trigger="Reject"
        title="Reject screenshot"
        description="The customer sees your reason and can upload a new screenshot."
        submitLabel="Reject screenshot"
        submitVariant="danger"
        action={reviewPaymentProof.bind(null, number, proofId, 'reject')}
      >
        {(errors) => (
          <Field
            id={`${id}-reason`}
            label="Reason for the customer"
            hint="E.g. “The amount does not match” or “The screenshot is unreadable”."
            error={errors.reason}
            required
          >
            {(control) => <Input {...control} name="reason" maxLength={300} required autoFocus />}
          </Field>
        )}
      </ActionDialog>
    </div>
  );
}
