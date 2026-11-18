import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Pill buttons. Every CTA on the site is a black pill with white text and
 * a thin gold border — except `gold` (Subscribe) which uses the gold gradient.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2.5 rounded-full font-display whitespace-nowrap',
    'transition-all duration-300 ease-elegant',
    'disabled:pointer-events-none disabled:opacity-60',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-[1.5px] border-gold bg-ink text-white hover:-translate-y-0.5 hover:shadow-gold-glow',
        gold: 'bg-gold-gradient text-ink hover:brightness-105 hover:shadow-gold-glow',
        ghost: 'text-text hover:text-gold',
      },
      size: {
        sm: 'px-4 py-1.5 text-base',
        md: 'px-7 py-2.5 text-[17px]',
        lg: 'px-10 py-3.5 text-[26px] leading-none',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

const arrowSize = { sm: 16, md: 18, lg: 24 } as const;

interface ButtonContentProps {
  children: ReactNode;
  withArrow?: boolean;
  size?: ButtonVariantProps['size'];
}

function ButtonContent({ children, withArrow, size }: ButtonContentProps) {
  return (
    <>
      <span>{children}</span>
      {withArrow ? <ArrowRight aria-hidden size={arrowSize[size ?? 'md']} strokeWidth={2} /> : null}
    </>
  );
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'>, ButtonVariantProps {
  /** Render the trailing "→" arrow used on Shop Now CTAs. */
  withArrow?: boolean;
}

export function Button({
  className,
  variant,
  size,
  withArrow,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <ButtonContent withArrow={withArrow} size={size}>
        {children}
      </ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'href'>, ButtonVariantProps {
  href: Route;
  withArrow?: boolean;
}

export function ButtonLink({
  className,
  variant,
  size,
  withArrow,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <ButtonContent withArrow={withArrow} size={size}>
        {children}
      </ButtonContent>
    </Link>
  );
}
