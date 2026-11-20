import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

import { inputClasses } from './input';

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(inputClasses, 'h-auto min-h-20 resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  );
}
