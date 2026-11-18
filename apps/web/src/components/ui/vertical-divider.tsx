import { cn } from '@/lib/utils/cn';

interface VerticalDividerProps {
  className?: string;
  tone?: 'gold' | 'dark';
}

/** Thin vertical separator used in the top bar, features bar and footer. */
export function VerticalDivider({ className, tone = 'gold' }: VerticalDividerProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block w-px shrink-0 self-stretch',
        tone === 'gold' ? 'bg-gold' : 'bg-text/70',
        className,
      )}
    />
  );
}
