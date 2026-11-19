'use client';

import { Star } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@/lib/utils/cn';

const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

interface StarRatingInputProps {
  name: string;
  defaultValue?: number;
  /** Ids of hint/error text describing the group. */
  describedBy?: string;
  invalid?: boolean;
  labelledBy: string;
}

/**
 * Accessible 1–5 star picker: a native radio group (arrow keys, form submission and
 * required-ness come for free) visually rendered as stars with hover preview.
 */
export function StarRatingInput({
  name,
  defaultValue = 0,
  describedBy,
  invalid,
  labelledBy,
}: StarRatingInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const id = useId();
  const shown = hover || value;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex items-center gap-3"
      onMouseLeave={() => setHover(0)}
    >
      <div className="flex">
        {LABELS.map((label, i) => {
          const rating = i + 1;
          return (
            <label
              key={rating}
              htmlFor={`${id}-${rating}`}
              onMouseEnter={() => setHover(rating)}
              className="cursor-pointer p-1 has-[input:focus-visible]:rounded-md has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-gold-dark"
            >
              <input
                id={`${id}-${rating}`}
                type="radio"
                name={name}
                value={rating}
                checked={value === rating}
                onChange={() => setValue(rating)}
                className="sr-only"
              />
              <Star
                aria-hidden
                size={30}
                strokeWidth={1.4}
                className={cn(
                  'transition-colors duration-150',
                  rating <= shown ? 'fill-gold text-gold' : 'text-gold/50',
                )}
              />
              <span className="sr-only">
                {rating} {rating === 1 ? 'star' : 'stars'} — {label}
              </span>
            </label>
          );
        })}
      </div>
      <span aria-hidden className="min-w-20 font-body text-[16px] font-semibold text-muted">
        {shown ? LABELS[shown - 1] : ''}
      </span>
    </div>
  );
}
