'use client';

import { startTransition, useActionState, useId, useRef } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

import { type ActionState, addOrderNote } from '../actions';

/** Adds a note to the timeline: internal by default, or shown to the customer. */
export function NoteForm({ number }: { number: string }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await addOrderNote(number, prev, formData);
    if (result.done) {
      toast.success(result.done);
      form.current?.reset();
    }
    return result;
  }, {});

  return (
    <form
      ref={form}
      // Submitted by hand so a failed attempt keeps the text (a form `action` always resets).
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-3"
      noValidate
    >
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id={`${id}-note`} label="Add a note" error={state.fieldErrors?.note}>
        {(control) => <Textarea {...control} name="note" maxLength={1000} rows={2} required />}
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox
          name="customerVisible"
          label="Show to the customer"
          hint="On their order page and tracking timeline."
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Adding…' : 'Add note'}
        </Button>
      </div>
    </form>
  );
}
