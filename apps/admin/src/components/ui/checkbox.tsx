import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/** A checkbox with its label (and an optional line of explanation) beside it. */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-[14px]', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-ink"
        {...props}
      />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
