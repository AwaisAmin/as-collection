'use client';

import type { AdminCustomerDto } from '@as/contracts';
import { type FormEvent, useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { StaleAlert } from '@/components/ui/save-bar';
import { Textarea } from '@/components/ui/textarea';
import type { SaveState } from '@/lib/action-state';

import { blockCustomer, unblockCustomer, updateCustomer } from '../actions';

/** Name, marketing consent and the internal note; saved with the version it was loaded from. */
export function CustomerEditForm({
  customer,
  canWrite,
}: {
  customer: AdminCustomerDto;
  canWrite: boolean;
}) {
  const id = useId();
  const initial = {
    name: customer.name ?? '',
    marketingOptIn: customer.marketingOptIn,
    staffNote: customer.staffNote ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const name = draft.name.trim();
    if (!name && customer.name) {
      setLocal({ name: 'Keep a name (it shows on their orders).' });
      return {};
    }
    setLocal({});
    const result = await updateCustomer(customer.id, prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const errors = { ...(state.errors ?? {}), ...local };

  // Only what changed is sent, so a save never rewrites a field nobody touched.
  const changes: Record<string, unknown> = { updatedAt: customer.updatedAt };
  if (draft.name.trim() !== initial.name && draft.name.trim()) changes.name = draft.name.trim();
  if (draft.marketingOptIn !== initial.marketingOptIn) {
    changes.marketingOptIn = draft.marketingOptIn;
  }
  if (draft.staffNote.trim() !== initial.staffNote)
    changes.staffNote = draft.staffNote.trim() || null;

  const [, start] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set('payload', JSON.stringify(changes));
    start(() => action(data));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {state.stale ? <StaleAlert what="customer" /> : null}
      {state.error && !state.stale && state.at && !state.errors ? (
        <Alert tone="error">{state.error}</Alert>
      ) : null}
      <fieldset disabled={!canWrite} className="flex flex-col gap-4">
        <Field id={`${id}-name`} label="Name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              maxLength={120}
              autoComplete="off"
            />
          )}
        </Field>
        <Checkbox
          label="Wants news and offers"
          hint="Change it only when the customer asks you to."
          checked={draft.marketingOptIn}
          onChange={(event) => setDraft((d) => ({ ...d, marketingOptIn: event.target.checked }))}
        />
        <Field
          id={`${id}-note`}
          label="Internal note"
          hint="Only staff see it, e.g. “Prefers delivery after 5 pm.”"
          error={errors.staffNote}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={2000}
              value={draft.staffNote}
              onChange={(event) => setDraft((d) => ({ ...d, staffNote: event.target.value }))}
            />
          )}
        </Field>
      </fieldset>
      {canWrite ? (
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? 'Saving…' : 'Save customer'}
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setDraft(initial);
                setLocal({});
              }}
            >
              Undo
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** Block (signs them out everywhere, stops sign-ins) or unblock the account. */
export function AccountActions({ customer }: { customer: AdminCustomerDto }) {
  const id = useId();
  const [pending, start] = useTransition();
  if (customer.status === 'BLOCKED') {
    return (
      <Button
        variant="secondary"
        disabled={pending}
        className="w-full sm:w-auto"
        onClick={() =>
          start(async () => {
            const result = await unblockCustomer(customer.id);
            if (result.done) toast.success(result.done);
            else if (result.error) toast.error(result.error);
          })
        }
      >
        Unblock account
      </Button>
    );
  }
  return (
    <ActionDialog
      trigger="Block account"
      triggerVariant="secondary"
      triggerClassName="text-danger"
      title="Block this account"
      description="They are signed out on every device and can’t sign in to this account. Their orders stay as they are. You can unblock it later."
      submitLabel="Block account"
      submitVariant="danger"
      action={blockCustomer.bind(null, customer.id)}
    >
      {(errors) => (
        <Field
          id={`${id}-reason`}
          label="Reason"
          hint="Only staff see it, e.g. “Repeated fake orders.”"
          error={errors.reason}
          required
        >
          {(control) => <Textarea {...control} name="reason" rows={2} maxLength={300} />}
        </Field>
      )}
    </ActionDialog>
  );
}
