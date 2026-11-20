import type { AdminStockListDto } from '@as/contracts';
import { Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TabsNav } from '@/components/ui/tabs-nav';
import { StockTable } from '@/features/stock/components/stock-table';
import {
  parseStockQuery,
  STOCK_PAGE_SIZE,
  STOCK_VIEWS,
  stockListHref,
  toStockApiQuery,
} from '@/features/stock/query';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Stock' };

export default async function StockPage({ searchParams }: PageProps<'/stock'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const query = parseStockQuery(await searchParams);
  const list = await apiRequest<AdminStockListDto>('/admin/inventory', {
    token,
    query: toStockApiQuery(query),
  }).catch(() => null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Stock</h1>
        <p className="text-[14px] text-muted">
          Units per variant. Every change is recorded with its reason and who made it.
        </p>
      </div>

      <TabsNav
        label="Stock views"
        tabs={STOCK_VIEWS.map((view) => ({
          href: stockListHref(query, { view: view.key }),
          label: view.label,
          active: view.key === query.view,
        }))}
      />

      <form action="/stock" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
              placeholder="SKU (start of it) or product name"
              maxLength={100}
              className="pl-9"
            />
          </span>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            Search
          </Button>
          {query.q ? (
            <Link
              href={stockListHref({ ...query, q: undefined }, {}) as Route}
              className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {!list ? (
        <Alert tone="error">Stock could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <StockTable items={list.items} canWrite={can(permissions, 'inventory.write')} />
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            pageSize={STOCK_PAGE_SIZE}
            href={(page) => stockListHref(query, { page })}
          />
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">
            {query.q ? 'Nothing matches' : query.view === 'all' ? 'No variants yet' : 'All good'}
          </p>
          <p className="text-[14px] text-muted">
            {query.q
              ? 'Try a different SKU or product name.'
              : query.view === 'all'
                ? 'Variants appear here once products are added.'
                : 'No variants in this view right now.'}
          </p>
        </div>
      )}
    </div>
  );
}
