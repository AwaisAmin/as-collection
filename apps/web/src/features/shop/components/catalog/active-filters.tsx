'use client';

import { X } from 'lucide-react';

import { occasionName } from '@/config/occasions';
import { catalogHref, clearFilters, countActiveFilters } from '@/features/catalog/lib/catalog-url';
import type { CatalogQuery } from '@/features/catalog/schemas';
import { formatPrice } from '@/lib/utils/format';

import { useCatalogNavigation } from './catalog-navigation';

interface ActiveFiltersProps {
  query: CatalogQuery;
  basePath: string;
  includeCategory?: boolean;
}

/** Removable chips for each applied filter + "Clear all". */
export function ActiveFilters({ query, basePath, includeCategory }: ActiveFiltersProps) {
  const { navigate } = useCatalogNavigation();
  if (countActiveFilters(query) === 0) return null;

  const go = (patch: Partial<CatalogQuery>) =>
    navigate(catalogHref(basePath, query, patch, { includeCategory }));

  const chips: { key: string; label: string; remove: Partial<CatalogQuery> }[] = [];

  if (query.min !== undefined || query.max !== undefined) {
    const label =
      query.min !== undefined && query.max !== undefined
        ? `${formatPrice(query.min)} – ${formatPrice(query.max)}`
        : query.min !== undefined
          ? `From ${formatPrice(query.min)}`
          : `Up to ${formatPrice(query.max!)}`;
    chips.push({ key: 'price', label, remove: { min: undefined, max: undefined } });
  }
  for (const size of query.size) {
    chips.push({
      key: `size-${size}`,
      label: `Size: ${size}`,
      remove: { size: query.size.filter((s) => s !== size) },
    });
  }
  for (const shade of query.shade) {
    chips.push({
      key: `shade-${shade}`,
      label: shade,
      remove: { shade: query.shade.filter((s) => s !== shade) },
    });
  }
  for (const occasion of query.occasion) {
    chips.push({
      key: `occasion-${occasion}`,
      label: occasionName(occasion),
      remove: { occasion: query.occasion.filter((o) => o !== occasion) },
    });
  }
  if (query.inStock) chips.push({ key: 'stock', label: 'In stock', remove: { inStock: false } });
  if (query.sale) chips.push({ key: 'sale', label: 'On sale', remove: { sale: false } });

  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => go(chip.remove)}
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold bg-ivory px-3.5 py-1.5 font-body text-[15px] font-semibold text-text transition-colors hover:bg-sand"
          >
            {chip.label}
            <X aria-hidden size={14} />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => go(clearFilters(query))}
          className="px-2 font-body text-[15px] font-semibold text-gold-dark underline-offset-4 hover:underline"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}
