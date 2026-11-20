'use client';

import { useActionState, useId } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { changePasswordAction, type PasswordState } from '../actions';

/** Change own password; other devices are signed out, this one continues. */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {} as PasswordState);
  const id = useId();
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id={`${id}-current`} label="Current password" error={errors.current} required>
        {(control) => (
          <Input
            {...control}
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>
      <Field
        id={`${id}-next`}
        label="New password"
        hint="At least 12 characters. A short sentence works well."
        error={errors.next}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="next"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        )}
      </Field>
      <Field id={`${id}-confirm`} label="Repeat new password" error={errors.confirm} required>
        {(control) => (
          <Input {...control} name="confirm" type="password" autoComplete="new-password" required />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
