import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

const linkClasses =
  'border-line bg-surface inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-[14px] hover:bg-canvas';

/** "Showing 26–50 of 312" with previous / next links. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  href,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-[14px]">
      <p className="text-muted tabular-nums">
        {from > total
          ? 'No more results'
          : `Showing ${String(from)}–${String(to)} of ${String(total)}`}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1) as Route} className={linkClasses} rel="prev">
            <ChevronLeft aria-hidden size={16} />
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={href(page + 1) as Route} className={cn(linkClasses)} rel="next">
            Next
            <ChevronRight aria-hidden size={16} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
