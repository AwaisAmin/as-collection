import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils/cn';

/** Loading placeholder block. Pair with `aria-busy` on the region that is loading. */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-md bg-sand', className)} {...props} />
  );
}
