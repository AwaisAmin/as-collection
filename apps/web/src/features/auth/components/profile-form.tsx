'use client';

import { BadgeCheck } from 'lucide-react';
import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useSubmitKeepingValues } from '@/hooks/use-submit-keeping-values';
import { formatPkMobile } from '@/lib/utils/phone';

import { type FormState, updateProfileAction } from '../actions';
import type { User } from '../types';

const initial: FormState<'name' | 'email'> = { status: 'idle' };

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);
  const submit = useSubmitKeepingValues(formAction);
  const base = useId();
  const errors = state.status === 'error' ? state.fieldErrors : {};

  useEffect(() => {
    if (state.status === 'success') toast.success(state.message);
  }, [state]);

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-xl flex-col gap-5 rounded-card border border-gold/60 bg-ivory p-5 sm:p-7"
    >
      <FormField id={`${base}-name`} label="Full name" required error={errors.name}>
        {(a11y) => (
          <Input
            {...a11y}
            name="name"
            autoComplete="name"
            maxLength={80}
            defaultValue={user.name}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-1.5">
        <p className="px-1 font-display text-[16px] text-ink">Mobile number</p>
        {user.phone ? (
          <p className="flex items-center gap-2 rounded-full border border-gold/50 bg-cream px-5 py-2.5 text-[17px]">
            {formatPkMobile(user.phone)}
            <span className="ml-auto inline-flex items-center gap-1 text-[14px] font-semibold text-gold-dark">
              <BadgeCheck aria-hidden size={16} /> Verified
            </span>
          </p>
        ) : (
          <p className="rounded-xl bg-sand/70 px-4 py-3 text-[15px] text-muted">
            No phone yet — it&apos;s added at your first checkout. Sign in with your number to see
            past guest orders.
          </p>
        )}
      </div>

      <FormField
        id={`${base}-email`}
        label="Email"
        error={errors.email}
        hint="For order receipts and offers"
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={120}
            defaultValue={user.email}
          />
        )}
      </FormField>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
