import { Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { PRODUCT_SORTS, productListHref, type ProductListQuery } from '../query';

/** Search, category, low stock and sort as a plain GET form (shareable, works without JS). */
export function ProductFilters({
  query,
  categories,
}: {
  query: ProductListQuery;
  categories: readonly { id: string; label: string }[];
}) {
  const filtered = Boolean(query.q || query.category || query.low || query.brand);
  return (
    <form action="/products" role="search" className="flex flex-col gap-3 lg:flex-row lg:items-end">
      {query.tab !== 'all' ? <input type="hidden" name="status" value={query.tab} /> : null}
      {query.brand ? <input type="hidden" name="brand" value={query.brand} /> : null}
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-[13px] font-medium">Search</span>
        <span className="relative">
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Name, slug or SKU"
            maxLength={100}
            className="pl-9"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1.5 lg:w-56">
        <span className="text-[13px] font-medium">Category</span>
        <Select name="category" defaultValue={query.category ?? ''}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 lg:w-44">
        <span className="text-[13px] font-medium">Sort by</span>
        <Select name="sort" defaultValue={query.sort}>
          {PRODUCT_SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </Select>
      </label>
      <Checkbox
        // Starts over when the URL's value changes (defaultChecked is read only once).
        key={String(query.low)}
        name="low"
        value="1"
        defaultChecked={query.low}
        label="Low stock"
        className="lg:h-10 lg:items-center"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
          Apply
        </Button>
        {filtered ? (
          <Link
            href={
              productListHref(
                { ...query, q: undefined, category: undefined, brand: undefined, low: false },
                {},
              ) as Route
            }
            className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
