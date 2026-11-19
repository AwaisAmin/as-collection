'use client';

import { Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Used in button labels: "Increase quantity of Velvet Matte Lipstick". */
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/** − [n] + pill. Value is announced via an output element. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  size = 'md',
  disabled = false,
  className,
}: QuantityStepperProps) {
  const of = label ? ` of ${label}` : '';
  const btn = cn(
    'flex items-center justify-center rounded-full text-ink transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
    size === 'md' ? 'size-10' : 'size-8',
  );

  return (
    <div
      role="group"
      aria-label={`Quantity${of}`}
      className={cn(
        'inline-flex items-center rounded-full border-[1.5px] border-gold bg-ivory p-1',
        size === 'md' ? 'h-[52px]' : 'h-10',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease quantity${of}`}
        className={btn}
      >
        <Minus aria-hidden size={size === 'md' ? 18 : 15} />
      </button>
      <output
        aria-live="polite"
        className={cn(
          'min-w-9 text-center font-body font-bold text-ink',
          size === 'md' ? 'text-[19px]' : 'text-[16px]',
        )}
      >
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase quantity${of}`}
        className={btn}
      >
        <Plus aria-hidden size={size === 'md' ? 18 : 15} />
      </button>
    </div>
  );
}
