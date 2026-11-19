'use client';

import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

import { subscribeToNewsletter } from '../actions/subscribe';
import { HONEYPOT_FIELD, initialSubscribeState, newsletterSchema } from '../schema';

export function NewsletterForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialSubscribeState);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  // Toast for outcomes; field-level validation errors are shown inline instead.
  useEffect(() => {
    if (state.status === 'success') toast.success(state.message);
    if (state.status === 'error' && !state.field) toast.error(state.message);
    if (state.status === 'error' && state.field) inputRef.current?.focus();
  }, [state]);

  const serverFieldError = state.status === 'error' && state.field ? state.message : null;
  const error = clientError ?? serverFieldError;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = newsletterSchema.safeParse({
      email: new FormData(event.currentTarget).get('email'),
    });
    if (!result.success) {
      event.preventDefault();
      setClientError(result.error.issues[0]?.message ?? 'Please enter a valid email address.');
      inputRef.current?.focus();
      return;
    }
    setClientError(null);
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-label="Newsletter signup"
      className={cn('relative w-full max-w-115', className)}
    >
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email address"
        // React resets uncontrolled fields after an action; keep the value when it failed.
        defaultValue={state.email}
        key={state.status === 'idle' ? 'idle' : state.at}
        variant="filled"
        size="lg"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={() => clientError && setClientError(null)}
        className="pr-34.5 sm:pr-45"
      />

      {/* Honeypot — visually hidden, skipped by keyboard and screen readers */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${inputId}-hp`}>Company</label>
        <input id={`${inputId}-hp`} name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
      </div>

      <Button
        type="submit"
        variant="gold"
        disabled={pending}
        aria-busy={pending}
        className="absolute inset-y-0 right-0 w-32 px-0 text-[18px] sm:w-41.75 sm:text-[22px]"
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
            <span className="sr-only">Subscribing…</span>
          </>
        ) : (
          'Subscribe'
        )}
      </Button>

      <p
        id={errorId}
        role="alert"
        className={cn(
          'absolute top-full left-0 mt-2 flex items-center gap-1.5 pl-5 font-body text-[15px] text-gold-light',
          !error && 'sr-only',
        )}
      >
        {error ? (
          <>
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </>
        ) : null}
      </p>
    </form>
  );
}
