'use client';

import { X } from 'lucide-react';

import type { SaveState } from '@/lib/action-state';

import { Alert } from './alert';
import { Button } from './button';

/** "Name", "Variants 2" … from an API field path (`variants.1.sku`). */
export function fieldLabel(path: string, labels: Readonly<Record<string, string>>): string {
  const [head = '', index] = path.split('.');
  const base = labels[head] ?? head;
  return index !== undefined && /^\d+$/.test(index) ? `${base} ${String(Number(index) + 1)}` : base;
}

/** Shown above an editor when its save was refused because someone else saved first. */
export function StaleAlert({ what }: { what: string }) {
  return (
    <Alert tone="error">
      Someone else saved this {what} while you were editing.{' '}
      <a href="" className="font-medium underline">
        Reload
      </a>{' '}
      to see their changes (yours will be lost), then edit again.
    </Alert>
  );
}

/**
 * The editor's sticky footer: what state the form is in (or what went wrong, with every field
 * problem listed), undo, and the save button that submits the editor's form by id.
 */
export function SaveBar({
  formId,
  state,
  errors,
  labels,
  isNew,
  dirty,
  pending,
  onUndo,
  createLabel,
  saveLabel,
  newText,
}: {
  formId: string;
  state: SaveState;
  /** Every current field problem (local checks and the API's). */
  errors: Record<string, string>;
  labels: Readonly<Record<string, string>>;
  isNew: boolean;
  dirty: boolean;
  pending: boolean;
  onUndo: () => void;
  createLabel: string;
  saveLabel: string;
  newText: string;
}) {
  const list = Object.entries(errors);
  return (
    <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:left-60">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="min-w-0 text-[14px]" role="status" aria-live="polite">
          {state.stale && state.at ? (
            // The full explanation sits above the form; the bar is where the person is looking.
            <span className="text-danger">
              Not saved: someone else saved meanwhile.{' '}
              <a href="" className="font-medium underline">
                Reload
              </a>
            </span>
          ) : state.error && state.at ? (
            <details className="text-danger">
              <summary className="cursor-pointer">{state.error}</summary>
              {list.length ? (
                <ul className="mt-1 list-disc pl-5 text-[13px]">
                  {list.map(([path, message]) => (
                    <li key={path}>
                      {fieldLabel(path, labels)}: {message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : (
            <span className="text-muted">
              {isNew ? newText : dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && dirty ? (
            <Button variant="ghost" onClick={onUndo} disabled={pending}>
              <X aria-hidden size={16} />
              Undo changes
            </Button>
          ) : null}
          <Button
            type="submit"
            form={formId}
            disabled={pending || (!isNew && !dirty)}
            className="flex-1"
          >
            {pending ? 'Saving…' : isNew ? createLabel : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
