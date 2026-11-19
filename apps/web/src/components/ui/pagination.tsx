import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

interface PaginationProps {
  page: number;
  pageCount: number;
  /** Builds the URL for a page (keeps the current filters). Server-side only. */
  hrefFor: (page: number) => Route;
  className?: string;
}

/** 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, pageCount: number, radius = 1): (number | 'gap')[] {
  const pages = new Set([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const itemBase =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-full border-[1.5px] px-3 font-display text-[16px] transition-colors duration-200';

export function Pagination({ page, pageCount, hrefFor, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const arrow = (target: number, label: string, Icon: typeof ChevronLeft, disabled: boolean) =>
    disabled ? (
      <span aria-hidden className={cn(itemBase, 'border-transparent text-muted/40')}>
        <Icon size={18} />
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        aria-label={label}
        className={cn(itemBase, 'border-transparent text-text hover:text-gold-dark')}
      >
        <Icon aria-hidden size={18} />
      </Link>
    );

  return (
    <nav aria-label="Pagination" className={cn('flex justify-center', className)}>
      <ul className="flex items-center gap-1.5">
        <li>{arrow(page - 1, 'Previous page', ChevronLeft, page <= 1)}</li>
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  itemBase,
                  p === page
                    ? 'border-gold bg-ink text-white'
                    : 'border-transparent text-text hover:text-gold-dark',
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>{arrow(page + 1, 'Next page', ChevronRight, page >= pageCount)}</li>
      </ul>
    </nav>
  );
}
