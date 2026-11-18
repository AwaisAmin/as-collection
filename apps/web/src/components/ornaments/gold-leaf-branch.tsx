import { useId } from 'react';

import { cn } from '@/lib/utils/cn';

/** A single leaf, pointing right from its origin, length 28. */
const LEAF = 'M0 0 C 5 -10, 20 -11, 28 0 C 20 11, 5 10, 0 0 Z';

/** [x, y, rotationDeg, scale] for leaves placed along the stem curve. */
const LEAVES: ReadonlyArray<readonly [number, number, number, number]> = [
  [28, 81.8, -82, 0.95],
  [28, 81.8, 6, 0.9],
  [45.6, 68.6, -84, 0.95],
  [45.6, 68.6, 2, 0.9],
  [64.8, 52.6, -86, 0.85],
  [64.8, 52.6, -2, 0.82],
  [85.6, 33.8, -88, 0.72],
  [85.6, 33.8, -6, 0.7],
  [106, 14, -44, 0.62],
];

interface GoldLeafBranchProps {
  className?: string;
  /** Mirror horizontally (branch grows up-left). */
  flip?: boolean;
  title?: string;
}

/** Gold olive/leaf branch ornament — used in the logo and newsletter band. */
export function GoldLeafBranch({ className, flip = false, title }: GoldLeafBranchProps) {
  const gradientId = useId();
  const fill = `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 124 100"
      className={cn(className, flip && '-scale-x-100')}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#a9792f" />
          <stop offset="50%" stopColor="#d9b46e" />
          <stop offset="100%" stopColor="#b8893e" />
        </linearGradient>
      </defs>
      <path
        d="M10 94 Q 50 70 108 12"
        fill="none"
        stroke={fill}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <g fill={fill}>
        {LEAVES.map(([x, y, r, s]) => (
          <path
            key={`${x}-${r}`}
            d={LEAF}
            transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
          />
        ))}
      </g>
    </svg>
  );
}
