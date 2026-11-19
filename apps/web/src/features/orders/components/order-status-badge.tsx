import { cn } from '@/lib/utils/cn';

import type { Order } from '../types';
import { orderStatusLabel } from './order-details';

const tone: Record<Order['status'], string> = {
  pending: 'border-gold bg-sand text-ink',
  confirmed: 'border-gold bg-ivory text-ink',
  processing: 'border-gold bg-ivory text-ink',
  shipped: 'border-gold bg-ink text-white',
  delivered: 'border-ink bg-ink text-white',
  cancelled: 'border-muted/40 bg-ivory text-muted line-through',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: Order['status'];
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 font-body text-[14px] font-bold whitespace-nowrap',
        tone[status],
        className,
      )}
    >
      {orderStatusLabel[status]}
    </span>
  );
}
