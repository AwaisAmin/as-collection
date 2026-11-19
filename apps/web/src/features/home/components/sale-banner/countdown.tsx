'use client';

import type { ReactNode } from 'react';

import { useNow } from '@/hooks/use-now';
import { formatDate } from '@/lib/utils/format';
import { splitDuration } from '@/lib/utils/time';

const units = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Mins'],
  ['seconds', 'Secs'],
] as const;

/**
 * Ticking countdown. The digits are hidden from screen readers (a per-second update would be
 * noise); they get the static end date instead. Shows "--" until hydrated.
 */
export function Countdown({ endsAt }: { endsAt: string }) {
  const now = useNow();
  const parts = now === null ? null : splitDuration(Date.parse(endsAt) - now);

  return (
    <div>
      <p className="sr-only">Offer ends {formatDate(endsAt)}.</p>
      <ol aria-hidden className="flex gap-2 sm:gap-3">
        {units.map(([key, label]) => (
          <li
            key={key}
            className="flex w-[68px] flex-col items-center rounded-xl border border-gold/70 bg-white/5 py-2.5 sm:w-20"
          >
            <span className="font-display text-[28px]/none text-white tabular-nums sm:text-[34px]/none">
              {parts ? String(parts[key]).padStart(2, '0') : '--'}
            </span>
            <span className="mt-1.5 font-caps text-[11px] tracking-[0.18em] text-gold-light uppercase">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Renders `children` until `endsAt`, then nothing — the page itself stays cached. */
export function UntilExpiry({ endsAt, children }: { endsAt: string; children: ReactNode }) {
  const now = useNow();
  if (now !== null && now >= Date.parse(endsAt)) return null;
  return <>{children}</>;
}
