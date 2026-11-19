'use client';

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: readonly TabItem[];
  label: string;
  /** `underline` (product details) or `pills` (centered black pills, home sections). */
  variant?: 'underline' | 'pills';
  className?: string;
}

const styles = {
  underline: {
    list: 'scrollbar-none flex gap-1 overflow-x-auto border-b border-gold/50',
    tab: '-mb-px shrink-0 border-b-2 px-4 py-3 font-display text-[17px] whitespace-nowrap transition-colors duration-200 sm:px-6 sm:text-[18px]',
    selected: 'border-ink text-ink',
    idle: 'border-transparent text-muted hover:text-gold-dark',
    panel: 'pt-6',
  },
  pills: {
    list: 'scrollbar-none mx-auto flex w-fit max-w-full gap-2 overflow-x-auto p-1 sm:gap-3',
    tab: 'shrink-0 rounded-full border-[1.5px] px-4 py-2 font-display text-[16px] whitespace-nowrap transition-colors duration-200 sm:px-7 sm:text-[17px]',
    selected: 'border-gold bg-ink text-white',
    idle: 'border-gold/60 bg-ivory text-text hover:border-gold hover:text-gold-dark',
    panel: 'pt-8',
  },
} as const;

/** WAI-ARIA tabs: roving tabindex, ←/→ Home/End keyboard support, automatic activation. */
export function Tabs({ items, label, variant = 'underline', className }: TabsProps) {
  const style = styles[variant];
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function onKeyDown(event: KeyboardEvent) {
    const last = items.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : event.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={style.list}>
        {items.map((item, i) => {
          const selected = i === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(style.tab, selected ? style.selected : style.idle)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={i !== active}
          tabIndex={0}
          className={cn(style.panel, 'focus-visible:outline-offset-4')}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
