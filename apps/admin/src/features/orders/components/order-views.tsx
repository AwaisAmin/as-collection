import type { AdminOrderCountsDto } from '@as/contracts';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

import { ORDER_VIEWS, orderListHref, type OrderListQuery, viewCount } from '../query';

/** Work queues as tabs, with how many orders wait in each. */
export function OrderViews({
  query,
  counts,
}: {
  query: OrderListQuery;
  counts: AdminOrderCountsDto | null;
}) {
  return (
    <nav
      aria-label="Order queues"
      className="border-line -mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
    >
      <ul className="flex gap-1">
        {ORDER_VIEWS.map((view) => {
          const active = view.key === query.view;
          const count = viewCount(view.key, counts);
          return (
            <li key={view.key}>
              <Link
                href={orderListHref(query, { view: view.key }) as Route}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap',
                  active
                    ? 'border-ink font-medium text-text'
                    : 'border-transparent text-muted hover:text-text',
                )}
              >
                {view.label}
                {count ? (
                  <span className="rounded-full bg-gold/20 px-1.5 text-[12px] font-semibold text-gold-dark tabular-nums">
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
