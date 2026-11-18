import { cn } from '@/lib/utils/cn';

interface ScriptTaglineProps {
  text: string;
  className?: string;
}

/** Great Vibes script line with a tapered underline swash and an outline heart. */
export function ScriptTagline({ text, className }: ScriptTaglineProps) {
  return (
    <p className={cn('relative inline-flex items-end font-script text-ink', className)}>
      <span className="relative">
        {text}
        <svg
          aria-hidden
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="absolute -bottom-[0.18em] left-[43%] h-[0.28em] w-[43%]"
        >
          <path d="M0 10 C 55 3, 140 0, 200 3 C 140 2.4, 55 5.6, 0 10 Z" fill="currentColor" />
        </svg>
      </span>
      <svg
        aria-hidden
        viewBox="0 0 48 44"
        className="mb-[0.12em] ml-[0.22em] h-[0.95em] w-[1.05em] -rotate-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 40 C 10 30, 2 21, 4 12 C 6 4, 16 1, 22 9 C 24 12, 24 13, 24 14 C 25 8, 31 2, 39 4 C 47 7, 47 18, 38 27 C 33 32, 28 36, 24 40 Z" />
      </svg>
      <span className="sr-only"> (love)</span>
    </p>
  );
}
