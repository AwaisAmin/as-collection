import { Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { reviewListHref, type ReviewListQuery } from '../query';

/** Search and filters as a plain GET form: works without JavaScript and gives shareable links. */
export function ReviewFilters({ query }: { query: ReviewListQuery }) {
  const filtered = Boolean(query.q || query.rating || query.featured);
  return (
    <form action="/reviews" className="flex flex-col gap-3 lg:flex-row lg:items-end" role="search">
      {query.view !== 'pending' ? <input type="hidden" name="view" value={query.view} /> : null}
      {query.product ? <input type="hidden" name="product" value={query.product} /> : null}
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
            placeholder="Words in the review, or the name"
            maxLength={100}
            className="pl-9"
          />
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3 lg:flex">
        <label className="flex flex-col gap-1.5 lg:w-36">
          <span className="text-[13px] font-medium">Rating</span>
          <Select name="rating" defaultValue={query.rating ? String(query.rating) : ''}>
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'star' : 'stars'}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 lg:w-44">
          <span className="text-[13px] font-medium">Home page</span>
          <Select name="featured" defaultValue={query.featured ?? ''}>
            <option value="">Any</option>
            <option value="1">Shown on home page</option>
          </Select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
          Apply
        </Button>
        {filtered ? (
          <Link
            href={
              reviewListHref(query, {
                q: undefined,
                rating: undefined,
                featured: undefined,
                before: undefined,
              }) as Route
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
