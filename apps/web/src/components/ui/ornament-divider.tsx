import { cn } from '@/lib/utils/cn';

interface OrnamentDividerProps {
  className?: string;
  /** Total width in px. */
  width?: number;
}

/** Thin gold line with a small diamond in the middle (under card titles). */
export function OrnamentDivider({ className, width = 86 }: OrnamentDividerProps) {
  const mid = width / 2;
  return (
    <svg
      aria-hidden
      className={cn('text-gold', className)}
      width={width}
      height={8}
      viewBox={`0 0 ${width} 8`}
      fill="none"
    >
      <line x1="0" y1="4" x2={width} y2="4" stroke="currentColor" strokeWidth="1" />
      <path d={`M${mid} 0.5 L${mid + 7} 4 L${mid} 7.5 L${mid - 7} 4 Z`} fill="currentColor" />
    </svg>
  );
}
