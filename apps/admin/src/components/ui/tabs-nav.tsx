import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export interface TabLink {
  href: string;
  label: string;
  active: boolean;
  /** Shown as a badge when above zero. */
  count?: number | null;
}

/** Link tabs (each tab is a URL), scrollable on phones. */
export function TabsNav({ label, tabs }: { label: string; tabs: readonly TabLink[] }) {
  return (
    <nav
      aria-label={label}
      className="border-line relative -mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
    >
      <ul className="flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href as Route}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap',
                tab.active
                  ? 'border-ink font-medium text-text'
                  : 'border-transparent text-muted hover:text-text',
              )}
            >
              {tab.label}
              {tab.count ? (
                <span className="rounded-full bg-gold/20 px-1.5 text-[12px] font-semibold text-gold-dark tabular-nums">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
