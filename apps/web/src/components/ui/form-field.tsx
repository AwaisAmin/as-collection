import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface FieldA11yProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FormFieldProps {
  /** Id of the control — wires up label, hint and error. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Extra content on the label row (e.g. a character counter). */
  aside?: ReactNode;
  className?: string;
  /** Render prop receives the a11y props to spread on the control. */
  children: (props: FieldA11yProps) => ReactNode;
}

/** Label + control + hint + error, with `aria-describedby`/`aria-invalid` wired for screen readers. */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  aside,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <label htmlFor={id} className="font-display text-[16px] text-ink">
          {label}
          {required ? (
            <span aria-hidden className="text-gold-dark">
              {' '}
              *
            </span>
          ) : (
            <span className="font-body text-[14px] text-muted"> (optional)</span>
          )}
        </label>
        {aside}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && !error ? (
        <p id={hintId} className="px-1 text-[14px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-gold-dark"
        >
          <CircleAlert aria-hidden size={15} className="shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
