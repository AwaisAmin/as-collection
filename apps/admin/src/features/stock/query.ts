import type { StockFilter } from '@as/contracts';
import { z } from 'zod';

/* The stock list's URL state: `?view=low&q=MKUP&page=2`. */

export const STOCK_VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
  { key: 'backorder', label: 'Backorders' },
] as const satisfies readonly { key: StockFilter; label: string }[];

export interface StockListQuery {
  view: StockFilter;
  q?: string;
  page: number;
}

export const STOCK_PAGE_SIZE = 50;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);

const schema = z.object({
  view: z.preprocess(first, z.enum(['all', 'low', 'out', 'backorder']).catch('all')),
  q: z.preprocess(first, z.string().trim().min(1).max(100).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});

export function parseStockQuery(searchParams: Record<string, unknown>): StockListQuery {
  const p = schema.parse(searchParams);
  return { view: p.view, page: p.page, ...(p.q ? { q: p.q } : {}) };
}

export const toStockApiQuery = (query: StockListQuery) => ({
  stock: query.view,
  q: query.q,
  page: query.page,
  pageSize: STOCK_PAGE_SIZE,
});

export function stockListHref(query: StockListQuery, change: Partial<StockListQuery>): string {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.view !== 'all') params.set('view', next.view);
  if (next.q) params.set('q', next.q);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `/stock?${search}` : '/stock';
}
