'use client';

import type { AdminPageDto } from '@as/contracts';
import { startTransition, useActionState, useId } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ActionState } from '@/lib/action-state';

import { updatePageDetails } from '../actions';

/** The page's title and what search engines show for it. */
export function PageDetails({ page, canWrite }: { page: AdminPageDto; canWrite: boolean }) {
  const id = useId();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await updatePageDetails(page.id, prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <fieldset disabled={!canWrite} className="contents">
        <input type="hidden" name="updatedAt" value={page.updatedAt} />
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <Field id={`${id}-title`} label="Title" error={state.fieldErrors?.title} required>
          {(control) => (
            <Input {...control} name="title" defaultValue={page.title} maxLength={160} />
          )}
        </Field>
        <Field
          id={`${id}-seo-title`}
          label="Search title"
          hint="What search engines show as the link. Empty: the store name."
        >
          {(control) => (
            <Input
              {...control}
              name="seoTitle"
              defaultValue={page.seoTitle ?? ''}
              maxLength={160}
            />
          )}
        </Field>
        <Field id={`${id}-seo-description`} label="Search description">
          {(control) => (
            <Textarea
              {...control}
              name="seoDescription"
              rows={3}
              defaultValue={page.seoDescription ?? ''}
              maxLength={320}
            />
          )}
        </Field>
        {canWrite ? (
          <div>
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
