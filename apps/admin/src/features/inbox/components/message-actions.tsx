'use client';

import type { AdminMessageDto } from '@as/contracts';
import { Archive, Inbox, MailWarning } from 'lucide-react';
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useTransition,
} from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import type { ActionState } from '@/lib/action-state';

import { markRead, saveStaffNote, setMessageStatus } from '../actions';

/** Marks a new message read once it is actually shown (never on link prefetch). */
export function MarkReadOnView({ id, isNew }: { id: string; isNew: boolean }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!isNew || sent.current) return;
    sent.current = true;
    void markRead(id);
  }, [id, isNew]);
  return null;
}

/** Archive / back to the inbox / mark unread. */
export function StatusButtons({ message }: { message: AdminMessageDto }) {
  const [pending, start] = useTransition();
  const set = (status: 'NEW' | 'READ' | 'ARCHIVED') =>
    start(async () => {
      const result = await setMessageStatus(message.id, status);
      if (result.done) toast.success(result.done);
      else if (result.error) toast.error(result.error);
    });
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {message.status === 'ARCHIVED' ? (
        <Button variant="secondary" disabled={pending} onClick={() => set('READ')}>
          <Inbox aria-hidden size={16} />
          Move back to inbox
        </Button>
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => set('ARCHIVED')}>
          <Archive aria-hidden size={16} />
          Archive
        </Button>
      )}
      {message.status !== 'NEW' ? (
        <Button variant="ghost" disabled={pending} onClick={() => set('NEW')}>
          <MailWarning aria-hidden size={16} />
          Mark as unread
        </Button>
      ) : null}
    </div>
  );
}

/** The internal note: staff only, never sent to the customer. */
export function StaffNoteForm({ message }: { message: AdminMessageDto }) {
  const id = useId();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveStaffNote(message.id, prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  // Submitted by hand: a form `action` would clear the text after a refused save.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {state.error && state.at ? <Alert tone="error">{state.error}</Alert> : null}
      <Field
        id={`${id}-note`}
        label="Internal note"
        hint="Only staff see it, e.g. “Called back, sending a replacement.”"
        error={state.fieldErrors?.staffNote}
      >
        {(control) => (
          <Textarea
            {...control}
            name="staffNote"
            rows={3}
            maxLength={2000}
            defaultValue={message.staffNote ?? ''}
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save note'}
      </Button>
    </form>
  );
}
