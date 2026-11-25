'use client';

import { ChevronDown, CircleCheck, Send } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitKeepingValues } from '@/hooks/use-submit-keeping-values';

import { type ContactState, sendContactMessage } from '../actions';
import { CONTACT_HONEYPOT, contactTopics } from '../schema';

const initial: ContactState = { status: 'idle' };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessage, initial);
  const [dismissed, setDismissed] = useState(false);
  const submit = useSubmitKeepingValues(formAction, () => setDismissed(false));
  const base = useId();
  const errors = state.status === 'error' ? state.fieldErrors : {};

  if (state.status === 'success' && !dismissed) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-card border border-gold bg-ivory px-6 py-12 text-center"
      >
        <CircleCheck aria-hidden className="size-12 text-gold-dark" strokeWidth={1.5} />
        <h3 className="font-display text-[26px]">Message sent — thank you!</h3>
        <p className="max-w-sm text-[17px] text-muted">
          Our team usually replies within a few hours during business hours.
        </p>
        <Button
          variant="ghost"
          className="border-[1.5px] border-gold"
          onClick={() => setDismissed(true)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid grid-cols-1 gap-5 rounded-card border border-gold/60 bg-ivory p-5 sm:grid-cols-2 sm:p-7"
    >
      {state.status === 'error' && state.message ? (
        <p role="alert" className="font-semibold text-gold-dark sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <FormField
        id={`${base}-name`}
        label="Your name"
        required
        error={errors.name}
        className="sm:col-span-2"
      >
        {(a11y) => <Input {...a11y} name="name" autoComplete="name" maxLength={80} />}
      </FormField>
      <FormField
        id={`${base}-phone`}
        label="Mobile number"
        error={errors.phone}
        hint="Phone or email — so we can reply"
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={16}
          />
        )}
      </FormField>
      <FormField id={`${base}-email`} label="Email" error={errors.email}>
        {(a11y) => (
          <Input {...a11y} name="email" type="email" autoComplete="email" maxLength={120} />
        )}
      </FormField>
      <FormField id={`${base}-topic`} label="Topic" required error={errors.topic}>
        {(a11y) => (
          <div className="relative">
            <select
              {...a11y}
              name="topic"
              defaultValue=""
              className="h-10.5 w-full appearance-none rounded-full border border-gold bg-transparent pr-10 pl-5 font-body text-[17px] text-text focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)] aria-invalid:shadow-[0_0_0_2px_var(--color-gold-light)]"
            >
              <option value="" disabled>
                Choose a topic
              </option>
              {contactTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              size={16}
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
            />
          </div>
        )}
      </FormField>
      <FormField id={`${base}-order`} label="Order number" error={errors.orderNumber}>
        {(a11y) => (
          <Input {...a11y} name="orderNumber" placeholder="AS-261119-XXXXX" maxLength={20} />
        )}
      </FormField>
      <FormField
        id={`${base}-message`}
        label="Message"
        required
        error={errors.message}
        className="sm:col-span-2"
      >
        {(a11y) => <Textarea {...a11y} name="message" rows={5} maxLength={2000} />}
      </FormField>

      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${base}-hp`}>Company website</label>
        <input id={`${base}-hp`} name={CONTACT_HONEYPOT} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <Send aria-hidden size={17} />
          {pending ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}
