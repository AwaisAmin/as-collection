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
    'aria-invalid:shadow-[0_0_0_2px_rgba(185,28,28,0.55)]',
  ],
  {
    variants: {
      variant: {
        outline: 'border border-gold bg-transparent focus:shadow-gold-glow',
        filled: 'border border-transparent bg-ivory focus:shadow-gold-glow',
      },
      size: {
        md: 'h-[42px] px-5 text-[17px]',
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
