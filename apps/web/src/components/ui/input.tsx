import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Pill text input.
 * - `outline`: transparent with thin gold border (header search)
 * - `filled`: cream fill, no border (newsletter on black)
 */
export const inputVariants = cva(
  [
    'w-full rounded-full font-body text-text transition-shadow duration-200',
    'placeholder:text-muted focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-60',
    // hide the native "x" on type="search" so it doesn't fight with our icon button
    '[&::-webkit-search-cancel-button]:hidden',
    'aria-invalid:shadow-[0_0_0_2px_var(--color-gold-light)]',
  ],
  {
    variants: {
      variant: {
        outline:
          'border border-gold bg-transparent focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]',
        filled:
          'border border-transparent bg-ivory focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]',
      },
      size: {
        md: 'h-10.5 px-5 text-[17px]',
        lg: 'h-14 px-7 text-[18px]',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface InputProps
  extends Omit<ComponentProps<'input'>, 'size'>, VariantProps<typeof inputVariants> {}

export function Input({ className, variant, size, type = 'text', ...props }: InputProps) {
  return (
    <input type={type} className={cn(inputVariants({ variant, size }), className)} {...props} />
  );
}
