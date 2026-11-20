import type { OrderStatus, PaymentStatus } from '@as/contracts';

import { Badge } from '@/components/ui/badge';

import { ORDER_STATUS, PAYMENT_STATUS } from '../labels';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = ORDER_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, tone } = PAYMENT_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
