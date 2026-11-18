import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils/cn';

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Required: icon-only controls must have an accessible name. */
  'aria-label': string;
}

export function IconButton({ className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full p-1 text-text transition-colors duration-200 hover:text-gold',
        className,
      )}
      {...props}
    />
  );
}
