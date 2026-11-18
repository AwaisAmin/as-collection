'use client';

import { type ComponentPropsWithoutRef, type CSSProperties, type ElementType, useRef } from 'react';

import { useInView } from '@/hooks/use-in-view';

type RevealProps<T extends ElementType> = {
  as?: T;
  /** Stagger delay in ms. */
  delay?: number;
} & ComponentPropsWithoutRef<T>;

/**
 * Fades + lifts its content in when scrolled into view (once).
 * Styling lives in globals.css (`[data-reveal]`); a <noscript> rule keeps
 * content visible without JS, and reduced-motion users get no movement.
 */
export function Reveal<T extends ElementType = 'div'>({
  as,
  delay = 0,
  style,
  ...props
}: RevealProps<T>) {
  const Component: ElementType = as ?? 'div';
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);

  return (
    <Component
      ref={ref}
      data-reveal=""
      data-revealed={inView ? '' : undefined}
      style={{ ...(style as CSSProperties), '--reveal-delay': `${delay}ms` } as CSSProperties}
      {...props}
    />
  );
}
