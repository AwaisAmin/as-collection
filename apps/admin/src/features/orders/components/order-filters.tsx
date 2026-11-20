import { Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { PAYMENT_METHOD } from '../labels';
import { orderListHref, type OrderListQuery, PAYMENT_METHODS } from '../query';

/** Search and filters as a plain GET form: works without JavaScript and gives shareable links. */
export function OrderFilters({ query }: { query: OrderListQuery }) {
  const filtered = Boolean(query.q || query.method || query.from || query.to);
  return (
    <form action="/orders" className="flex flex-col gap-3 lg:flex-row lg:items-end" role="search">
      {query.view !== 'all' ? <input type="hidden" name="view" value={query.view} /> : null}
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
            placeholder="Order number, phone or name"
            minLength={2}
            maxLength={80}
            className="pl-9"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1.5 lg:w-48">
        <span className="text-[13px] font-medium">Payment</span>
        <Select name="method" defaultValue={query.method ?? ''}>
          <option value="">Any method</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD[method]}
            </option>
          ))}
        </Select>
      </label>
      <div className="grid grid-cols-2 gap-3 lg:flex">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Placed from</span>
          <Input type="date" name="from" defaultValue={query.from} className="lg:w-40" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">to</span>
          <Input type="date" name="to" defaultValue={query.to} className="lg:w-40" />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
          Apply
        </Button>
        {filtered ? (
          <Link
            href={orderListHref({ view: query.view, page: 1 }, {}) as Route}
            className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
