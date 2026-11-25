import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

import { inputClasses } from './input';

/**
 * A styled native select. An uncontrolled one (`defaultValue`) starts over when its default
 * changes: React reads `defaultValue` only once, so a filter opened from another URL on the same
 * page would otherwise keep showing the old choice.
 */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        key={props.defaultValue === undefined ? undefined : String(props.defaultValue)}
        className={cn(inputClasses, 'appearance-none pr-9')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
