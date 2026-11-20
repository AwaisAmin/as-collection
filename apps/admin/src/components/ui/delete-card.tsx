'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import type { ActionState } from '@/lib/action-state';

import { Alert } from './alert';
import { Button } from './button';
import { Card } from './card';
import { Dialog } from './dialog';

/**
 * "Remove" card for an editor page: explains why deleting is blocked, or deletes after a
 * confirmation (errors stay inside the confirmation, which a toast would sit behind).
 */
export function DeleteCard({
  what,
  name,
  blockedReason,
  allowedText,
  consequence,
  onDelete,
}: {
  /** "attribute", "collection" … */
  what: string;
  name: string;
  /** Why it can't be deleted (null: it can). */
  blockedReason: string | null;
  allowedText: string;
  /** What deleting does, shown in the confirmation. */
  consequence: string;
  onDelete: () => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="text-[16px] font-semibold">Remove</h2>
      {blockedReason ? (
        <p className="text-[13px] text-muted">{blockedReason}</p>
      ) : (
        <>
          <p className="text-[13px] text-muted">{allowedText}</p>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden size={15} />
              Delete {what}
            </Button>
          </div>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={`Delete “${name}”?`}
            description={consequence}
          >
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Back
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await onDelete();
                    setError(result.error ?? null);
                  })
                }
              >
                {pending ? 'Deleting…' : `Delete ${what}`}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </Card>
  );
}
