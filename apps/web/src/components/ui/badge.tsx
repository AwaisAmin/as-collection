import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 font-caps text-[10px] leading-none font-semibold tracking-[0.14em] uppercase',
  {
    variants: {
      tone: {
        dark: 'border border-gold bg-ink text-white',
        gold: 'bg-gold-gradient text-ink',
        muted: 'border border-muted/30 bg-ivory text-muted',
      },
    },
    defaultVariants: { tone: 'dark' },
  },
);

export interface BadgeProps
  extends ComponentPropsWithoutRef<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
