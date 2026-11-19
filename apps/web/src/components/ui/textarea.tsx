import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

/** Multi-line input matching the outline `Input` (rounded instead of pill). */
export function Textarea({ className, rows = 5, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full resize-y rounded-2xl border border-gold bg-transparent px-5 py-3 font-body text-[17px] text-text transition-shadow duration-200',
        'placeholder:text-muted focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]',
        'disabled:opacity-60 aria-invalid:shadow-[0_0_0_2px_var(--color-gold-light)]',
        className,
      )}
      {...props}
    />
  );
}
