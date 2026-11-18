import type { ComponentPropsWithoutRef, ElementType } from 'react';

import { cn } from '@/lib/utils/cn';

type ContainerProps<T extends ElementType> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

/** Centered max-width wrapper (1200px) with responsive side gutters. */
export function Container<T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: ContainerProps<T>) {
  const Component: ElementType = as ?? 'div';
  return (
    <Component className={cn('mx-auto w-full max-w-site px-4 sm:px-6', className)} {...props} />
  );
}
