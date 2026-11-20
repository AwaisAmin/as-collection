import type { AdminOrderCountsDto, AdminOrderListDto } from '@as/contracts';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { OrderFilters } from '@/features/orders/components/order-filters';
import { OrderTable } from '@/features/orders/components/order-table';
import { OrderViews } from '@/features/orders/components/order-views';
import { orderListHref, PAGE_SIZE, parseOrderQuery, toApiQuery } from '@/features/orders/query';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'orders.read')) {
    return <Alert tone="error">Your role does not include orders.</Alert>;
  }
  const query = parseOrderQuery(await searchParams);

  const [list, counts] = await Promise.all([
    apiRequest<AdminOrderListDto>('/admin/orders', { token, query: toApiQuery(query) }).catch(
      () => null,
    ),
    apiRequest<AdminOrderCountsDto>('/admin/orders/counts', { token }).catch(() => null),
  ]);
  const filtered = Boolean(query.q || query.method || query.from || query.to);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Orders</h1>
        <p className="text-[14px] text-muted">Confirm, pack, ship and settle customer orders.</p>
      </div>

      <OrderViews query={query} counts={counts} />
      <OrderFilters query={query} />

      {!list ? (
        <Alert tone="error">Orders could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <OrderTable orders={list.items} />
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            pageSize={PAGE_SIZE}
            href={(page) => orderListHref(query, { page })}
          />
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{filtered ? 'No orders match' : 'Nothing here'}</p>
          <p className="text-[14px] text-muted">
            {filtered
              ? 'Try a different search or clear the filters.'
              : 'Orders in this queue will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
