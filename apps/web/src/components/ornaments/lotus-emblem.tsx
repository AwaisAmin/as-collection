import { useId } from 'react';

import { cn } from '@/lib/utils/cn';

/** Petal pointing up from the base point (60, 86). */
const PETAL = 'M60 86 C 47 66, 47 36, 60 10 C 73 36, 73 66, 60 86 Z';
const VEIN = 'M60 80 C 56 62, 56 40, 60 22';

/** [rotationDeg, scaleX, scaleY] for each petal around the base. */
const PETALS: ReadonlyArray<readonly [number, number, number]> = [
  [-62, 0.9, 0.62],
  [62, 0.9, 0.62],
  [-31, 0.95, 0.84],
  [31, 0.95, 0.84],
  [0, 1, 1],
];

interface LotusEmblemProps {
  className?: string;
}

/** Gold lotus / leaf crest used above the hero title. */
export function LotusEmblem({ className }: LotusEmblemProps) {
  const id = useId();
  const fill = `url(#${id}-fill)`;

  return (
    <svg viewBox="0 0 120 96" aria-hidden className={cn('overflow-visible', className)}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="1" x2="0.6" y2="0">
          <stop offset="0%" stopColor="#a9792f" />
          <stop offset="55%" stopColor="#d9b46e" />
          <stop offset="100%" stopColor="#b8893e" />
        </linearGradient>
      </defs>
      {PETALS.map(([r, sx, sy]) => (
        <g
          key={r}
          transform={`rotate(${r} 60 86) translate(60 86) scale(${sx} ${sy}) translate(-60 -86)`}
        >
          <path d={PETAL} fill={fill} stroke="#a9792f" strokeWidth="0.8" />
          <path d={VEIN} fill="none" stroke="#8a5f22" strokeOpacity="0.55" strokeWidth="1" />
        </g>
      ))}
      {/* base cup */}
      <path
        d="M44 88 Q 60 95 76 88"
        fill="none"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
