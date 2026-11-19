import { Star } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

interface RatingStarsProps {
  /** 0–5, fractional values render partial stars. */
  value: number;
  /** Optional review count shown after the stars. */
  count?: number;
  size?: number;
  className?: string;
}

/** Read-only star rating. Announced as "Rated 4.5 out of 5". */
export function RatingStars({ value, count, size = 16, className }: RatingStarsProps) {
  const clamped = Math.min(5, Math.max(0, value));
  const percent = (clamped / 5) * 100;
  const label = `Rated ${clamped.toFixed(1).replace(/\.0$/, '')} out of 5${
    count !== undefined ? `, ${count} ${count === 1 ? 'review' : 'reviews'}` : ''
  }`;

  const stars = (filled: boolean) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        aria-hidden
        size={size}
        strokeWidth={1.5}
        className={cn('shrink-0', filled ? 'fill-gold text-gold' : 'text-gold/45')}
      />
    ));

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      <span className="relative inline-flex">
        <span className="flex gap-0.5">{stars(false)}</span>
        <span
          className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden"
          style={{ width: `${percent}%` }}
        >
          {stars(true)}
        </span>
      </span>
      {count !== undefined ? (
        <span aria-hidden className="font-body text-[14px] text-muted">
          ({count})
        </span>
      ) : null}
    </span>
  );
}
