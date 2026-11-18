import { cva, type VariantProps } from 'class-variance-authority';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

/** Icon-only control: no chrome, gold on hover. Shared by buttons and links. */
export const iconButtonVariants = cva(
  'relative inline-flex items-center justify-center rounded-full transition-colors duration-200 hover:text-gold',
  {
    variants: {
      tone: {
        ink: 'text-ink',
        light: 'text-white',
      },
      padding: {
        none: 'p-0',
        sm: 'p-1',
      },
    },
    defaultVariants: { tone: 'ink', padding: 'sm' },
  },
);

type IconVariantProps = VariantProps<typeof iconButtonVariants>;

export interface IconButtonProps extends ComponentProps<'button'>, IconVariantProps {
  /** Required: icon-only controls must have an accessible name. */
  'aria-label': string;
}

export function IconButton({
  className,
  tone,
  padding,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(iconButtonVariants({ tone, padding }), className)}
      {...props}
    />
  );
}

export interface IconLinkProps extends Omit<ComponentProps<typeof Link>, 'href'>, IconVariantProps {
  href: Route;
  'aria-label': string;
}

export function IconLink({ className, tone, padding, ...props }: IconLinkProps) {
  return <Link className={cn(iconButtonVariants({ tone, padding }), className)} {...props} />;
}
