'use client';

import { type FormEvent, startTransition } from 'react';

/**
 * Submit handler for forms backed by `useActionState`. A form `action` makes React reset every
 * field after each submission — including a refused one, so what the shopper typed vanished and
 * the old value came back next to the error. Submitting by hand keeps the fields as typed.
 */
export function useSubmitKeepingValues(
  dispatch: (formData: FormData) => void,
  before?: () => void,
): (event: FormEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    before?.();
    startTransition(() => dispatch(formData));
  };
}
