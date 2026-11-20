import type { AdminOrderCountsDto, OrderStatus, PaymentMethod, PaymentStatus } from '@as/contracts';
import { z } from 'zod';

/*
 * The order list's URL state: `?view=to-ship&q=0300…&method=COD&from=…&to=…&page=2`. Anything
 * invalid is dropped rather than shown as an error — a mistyped link still opens the list.
 */

export const ORDER_VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'to-confirm', label: 'To confirm' },
  { key: 'payments', label: 'Payments to check' },
  { key: 'to-ship', label: 'To ship' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'closed', label: 'Cancelled & returned' },
] as const;

export type OrderView = (typeof ORDER_VIEWS)[number]['key'];

const VIEW_FILTER: Record<OrderView, { status?: OrderStatus[]; paymentStatus?: PaymentStatus[] }> =
  {
    all: {},
    'to-confirm': { status: ['PENDING'] },
    payments: { paymentStatus: ['AWAITING_VERIFICATION'] },
    'to-ship': { status: ['CONFIRMED', 'PROCESSING'] },
    shipped: { status: ['SHIPPED'] },
    delivered: { status: ['DELIVERED'] },
    closed: { status: ['CANCELLED', 'RETURNED'] },
  };

export const PAYMENT_METHODS = ['COD', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA'] as const;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional().catch(undefined));

const searchSchema = z.object({
  view: z.preprocess(
    first,
    z.enum(ORDER_VIEWS.map((v) => v.key) as [OrderView, ...OrderView[]]).catch('all'),
  ),
  q: optional(z.string().trim().min(2).max(80)),
  method: optional(z.enum(PAYMENT_METHODS)),
  from: optional(z.iso.date()),
  to: optional(z.iso.date()),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});

export interface OrderListQuery {
  view: OrderView;
  q?: string;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  page: number;
}

export const PAGE_SIZE = 25;

export function parseOrderQuery(searchParams: Record<string, unknown>): OrderListQuery {
  const parsed = searchSchema.parse(searchParams);
  return {
    view: parsed.view,
    page: parsed.page,
    ...(parsed.q ? { q: parsed.q } : {}),
    ...(parsed.method ? { method: parsed.method } : {}),
    ...(parsed.from ? { from: parsed.from } : {}),
    ...(parsed.to ? { to: parsed.to } : {}),
  };
}

/** The API query for this list state. */
export function toApiQuery(query: OrderListQuery) {
  const filter = VIEW_FILTER[query.view];
  return {
    status: filter.status,
    paymentStatus: filter.paymentStatus,
    paymentMethod: query.method,
    q: query.q,
    from: query.from,
    to: query.to,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}

/** The link to this list with some state changed (page resets unless given). */
export function orderListHref(query: OrderListQuery, change: Partial<OrderListQuery>): string {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.view !== 'all') params.set('view', next.view);
  if (next.q) params.set('q', next.q);
  if (next.method) params.set('method', next.method);
  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `/orders?${search}` : '/orders';
}

/** Badge number for a view tab (null: no badge). */
export function viewCount(view: OrderView, counts: AdminOrderCountsDto | null): number | null {
  if (!counts) return null;
  switch (view) {
    case 'to-confirm':
      return counts.toConfirm;
    case 'payments':
      return counts.awaitingPaymentReview;
    case 'to-ship':
      return counts.toShip;
    default:
      return null;
  }
}
