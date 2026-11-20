import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('border-line bg-surface shadow-card rounded-card border', className)}
      {...props}
    />
  );
}
