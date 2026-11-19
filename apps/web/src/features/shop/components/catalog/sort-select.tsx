'use client';

import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

import { catalogHref } from '@/features/catalog/lib/catalog-url';
import { type CatalogQuery, sortOptions, type SortValue } from '@/features/catalog/schemas';

import { useCatalogNavigation } from './catalog-navigation';

interface SortSelectProps {
  query: CatalogQuery;
  basePath: string;
  includeCategory?: boolean;
}

export function SortSelect({ query, basePath, includeCategory }: SortSelectProps) {
  const { navigate } = useCatalogNavigation();
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="hidden text-[16px] text-muted sm:inline">
        Sort by
      </label>
      <div className="relative">
        <select
          id={id}
          value={query.sort}
          onChange={(e) =>
            navigate(
              catalogHref(
                basePath,
                query,
                { sort: e.target.value as SortValue },
                { includeCategory },
              ),
            )
          }
          aria-label="Sort products"
          className="h-10 cursor-pointer appearance-none rounded-full border border-gold bg-ivory py-0 pr-10 pl-4 font-body text-[16px] font-semibold text-text focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink"
        />
      </div>
    </div>
  );
}
