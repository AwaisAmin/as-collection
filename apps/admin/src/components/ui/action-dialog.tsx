'use client';

import { type ReactNode, startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { ActionState } from '@/lib/action-state';
import { cn } from '@/lib/utils/cn';

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

interface ActionDialogProps {
  /** Text of the button that opens the dialog. */
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  /** Accessible name when the trigger is only an icon. */
  triggerLabel?: string;
  disabled?: boolean;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  action: FormAction;
  /** Wider dialogs for longer forms. */
  dialogClassName?: string;
  /** The form's fields; they receive the latest field errors. */
  children?: (fieldErrors: Record<string, string>) => ReactNode;
}

/** A button that opens a small form in a modal; success closes it and shows a toast. */
export function ActionDialog({
  trigger,
  triggerVariant = 'secondary',
  triggerSize,
  triggerClassName,
  triggerLabel,
  disabled,
  title,
  description,
  submitLabel,
  submitVariant = 'primary',
  action,
  dialogClassName,
  children,
}: ActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.done) {
        toast.success(result.done);
        setOpen(false);
      }
      return result;
    },
    {},
  );
  // A result already seen is not shown again when the dialog is reopened.
  const [cleared, setCleared] = useState<number | undefined>();
  const current = state.at !== undefined && state.at !== cleared;
  const fieldErrors = current ? (state.fieldErrors ?? {}) : {};

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          setCleared(state.at);
          setOpen(true);
        }}
        className={cn('w-full sm:w-auto', triggerClassName)}
      >
        {trigger}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        className={dialogClassName}
      >
        <form
          // Submitted by hand: a form `action` would reset every field after each attempt, so a
          // rejected save would silently throw away what was typed.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          {current && state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {children?.(fieldErrors)}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Back
            </Button>
            <Button type="submit" variant={submitVariant} disabled={pending}>
              {pending ? 'Saving…' : submitLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
