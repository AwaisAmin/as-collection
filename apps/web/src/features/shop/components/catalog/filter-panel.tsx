'use client';

import { Check, ChevronDown } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { occasionName } from '@/config/occasions';
import {
  catalogHref,
  clearFilters,
  countActiveFilters,
  toggleValue,
} from '@/features/catalog/lib/catalog-url';
import type { CatalogQuery } from '@/features/catalog/schemas';
import type { CatalogFacets } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';

import { useCatalogNavigation } from './catalog-navigation';

export interface FilterPanelProps {
  query: CatalogQuery;
  facets: CatalogFacets;
  basePath: string;
  /** Search page: category is a query param. Shop page: category links go to /shop/[slug]. */
  categoryMode?: 'path' | 'param' | 'none';
  /** The admin's categories to offer (top level, plus the branch being browsed). */
  categories?: readonly { slug: string; name: string; depth: number }[];
  className?: string;
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="border-b border-gold/40 py-5 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between font-display text-[18px] text-ink transition-colors hover:text-gold-dark"
        >
          {title}
          <ChevronDown
            aria-hidden
            size={18}
            className={cn('transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </h3>
      <div id={id} hidden={!open} className="pt-4">
        {children}
      </div>
    </section>
  );
}

const chip =
  'inline-flex min-w-11 items-center justify-center rounded-full border-[1.5px] px-3.5 py-1.5 font-body text-[16px] font-semibold transition-colors duration-200';

export function FilterPanel({
  query,
  facets,
  basePath,
  categoryMode = 'none',
  categories = [],
  className,
}: FilterPanelProps) {
  const { navigate } = useCatalogNavigation();
  const includeCategory = categoryMode === 'param';
  const go = (patch: Partial<CatalogQuery>) =>
    navigate(catalogHref(basePath, query, patch, { includeCategory }));

  const sizes = facets.options.find((o) => o.name === 'Size')?.values ?? [];
  const shades = facets.options.find((o) => o.name === 'Shade')?.values ?? [];
  const active = countActiveFilters(query);

  function applyPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parse = (v: FormDataEntryValue | null) => {
      const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
      return String(v ?? '').trim() === '' || !Number.isFinite(n) ? undefined : n;
    };
    let min = parse(data.get('min'));
    let max = parse(data.get('max'));
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
    go({ min, max });
  }

  return (
    <div className={cn('font-body', className)}>
      {active > 0 ? (
        <div className="flex items-center justify-between pb-1">
          <p className="text-[16px] text-muted">{active} active</p>
          <button
            type="button"
            onClick={() => go(clearFilters(query))}
            className="text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {categoryMode !== 'none' ? (
        <FilterSection title="Category">
          <ul className="flex flex-col gap-1">
            {[{ slug: undefined, name: 'All products', depth: 0 }, ...categories].map((c) => {
              const current = query.category === c.slug;
              const onSelect = () =>
                categoryMode === 'path'
                  ? navigate(
                      catalogHref(c.slug ? `/shop/${c.slug}` : '/shop', query, {
                        category: undefined,
                      }),
                    )
                  : go({ category: c.slug });
              return (
                <li key={c.slug ?? 'all'} style={{ paddingLeft: `${String(c.depth * 14)}px` }}>
                  <button
                    type="button"
                    onClick={onSelect}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-full px-3 py-1.5 text-left text-[17px] transition-colors duration-200',
                      current ? 'bg-ink text-white' : 'text-text hover:text-gold-dark',
                    )}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterSection>
      ) : null}

      {facets.occasions.length > 0 ? (
        <FilterSection title="Occasion">
          <div role="group" aria-label="Occasion" className="flex flex-wrap gap-2">
            {facets.occasions.map(({ slug, count }) => {
              const selected = query.occasion.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => go({ occasion: toggleValue(query.occasion, slug) })}
                  className={cn(
                    chip,
                    selected
                      ? 'border-gold bg-ink text-white'
                      : 'border-gold/60 text-text hover:border-gold',
                  )}
                >
                  {occasionName(slug)}
                  <span
                    className={cn(
                      'ml-1.5 text-[14px] font-normal',
                      selected ? 'text-white/80' : 'text-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title="Price (Rs)">
        <form
          onSubmit={applyPrice}
          key={`${query.min}-${query.max}`}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">Minimum price</span>
              <input
                name="min"
                inputMode="numeric"
                defaultValue={query.min ?? ''}
                placeholder="Min"
                className="h-11 w-full rounded-full border border-gold bg-transparent px-4 text-[16px] placeholder:text-muted focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]"
              />
            </label>
            <span aria-hidden className="text-muted">
              –
            </span>
            <label className="flex-1">
              <span className="sr-only">Maximum price</span>
              <input
                name="max"
                inputMode="numeric"
                defaultValue={query.max ?? ''}
                placeholder="Max"
                className="h-11 w-full rounded-full border border-gold bg-transparent px-4 text-[16px] placeholder:text-muted focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]"
              />
            </label>
          </div>
          {/* No matching products → no range to show (it read "Rs 0 – Rs 0"). */}
          {facets.priceRange.max > 0 ? (
            <p className="text-[14px] text-muted">
              {formatPrice(facets.priceRange.min)} – {formatPrice(facets.priceRange.max)}
            </p>
          ) : null}
          <Button type="submit" size="sm" className="self-start">
            Apply
          </Button>
        </form>
      </FilterSection>

      {sizes.length > 0 ? (
        <FilterSection title="Size">
          <div role="group" aria-label="Size" className="flex flex-wrap gap-2">
            {sizes.map(({ value }) => {
              const selected = query.size.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => go({ size: toggleValue(query.size, value) })}
                  className={cn(
                    chip,
                    selected
                      ? 'border-gold bg-ink text-white'
                      : 'border-gold/60 text-text hover:border-gold',
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      {shades.length > 0 ? (
        <FilterSection title="Shade">
          <ul className="flex flex-col gap-1.5">
            {shades.map(({ value, swatch }) => {
              const selected = query.shade.includes(value);
              return (
                <li key={value}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => go({ shade: toggleValue(query.shade, value) })}
                    className="flex w-full items-center gap-3 rounded-full py-1 text-left text-[17px] text-text transition-colors hover:text-gold-dark"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-shadow',
                        selected
                          ? 'border-ink shadow-[0_0_0_2px_var(--color-gold)]'
                          : 'border-ivory shadow-[0_0_0_1px_var(--color-gold)]',
                      )}
                      style={{ backgroundColor: swatch }}
                    >
                      {selected ? <Check size={14} className="text-white drop-shadow" /> : null}
                    </span>
                    {value}
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterSection>
      ) : null}

      <FilterSection title="Show only">
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-[17px]">
            <input
              type="checkbox"
              checked={query.inStock}
              onChange={(e) => go({ inStock: e.target.checked })}
              className="size-5 accent-ink"
            />
            In stock
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-[17px]">
            <input
              type="checkbox"
              checked={query.sale}
              onChange={(e) => go({ sale: e.target.checked })}
              className="size-5 accent-ink"
            />
            On sale
          </label>
        </div>
      </FilterSection>
    </div>
  );
}
