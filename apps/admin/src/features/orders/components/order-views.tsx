import type { AdminOrderCountsDto } from '@as/contracts';

import { TabsNav } from '@/components/ui/tabs-nav';

import { ORDER_VIEWS, orderListHref, type OrderListQuery, viewCount } from '../query';

/** Work queues as tabs, with how many orders wait in each. */
export function OrderViews({
  query,
  counts,
}: {
  query: OrderListQuery;
  counts: AdminOrderCountsDto | null;
}) {
  return (
    <TabsNav
      label="Order queues"
      tabs={ORDER_VIEWS.map((view) => ({
        href: orderListHref(query, { view: view.key }),
        label: view.label,
        active: view.key === query.view,
        count: viewCount(view.key, counts),
      }))}
    />
  );
}
