'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Receives the props that tie the control to its label, hint and error. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + control + hint/error, wired for screen readers. An error goes away as soon as the
 * person changes the field (it described the old value) and comes back on the next submit if the
 * problem is still there.
 */
export function Field({ id, label, hint, error, required, children }: FieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edited, setEdited] = useState(false);
  const [shownFor, setShownFor] = useState(error);
  if (error !== shownFor) {
    // A different message (new submit, or a live check) is always shown.
    setShownFor(error);
    setEdited(false);
  }
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const reset = () => setEdited(false);
    form.addEventListener('submit', reset);
    return () => form.removeEventListener('submit', reset);
  }, []);

  const shown = edited ? undefined : error;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = shown ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const markEdited = () => {
    if (error) setEdited(true);
  };
  return (
    <div ref={ref} className="flex flex-col gap-1.5" onInput={markEdited} onChange={markEdited}>
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children({
        id,
        ...(shown ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {shown ? (
        <p id={errorId} className="text-danger text-[13px]">
          {shown}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
