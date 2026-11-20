import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export const inputClasses =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-text placeholder:text-muted/70 ' +
  'focus:border-gold-dark focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'aria-invalid:border-danger disabled:bg-canvas disabled:text-muted';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClasses, className)} {...props} />;
}
