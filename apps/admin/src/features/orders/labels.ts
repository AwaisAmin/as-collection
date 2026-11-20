import type {
  OrderStatus,
  PaymentMethod,
  PaymentProofStatus,
  PaymentStatus,
  StaffOrderAction,
} from '@as/contracts';

import type { BadgeTone } from '@/components/ui/badge';

/* Staff-facing names and colours for the order enums the API returns. */

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'New', tone: 'gold' },
  CONFIRMED: { label: 'Confirmed', tone: 'neutral' },
  PROCESSING: { label: 'Packing', tone: 'neutral' },
  SHIPPED: { label: 'Shipped', tone: 'warning' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  RETURNED: { label: 'Returned', tone: 'danger' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  UNPAID: { label: 'Unpaid', tone: 'neutral' },
  AWAITING_VERIFICATION: { label: 'Check payment', tone: 'gold' },
  PAID: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  COD: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
};

export const PROOF_STATUS: Record<PaymentProofStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'To review', tone: 'gold' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

/** Button text, the dialog's explanation, and the permission the API checks. */
export const ACTIONS: Record<
  StaffOrderAction,
  { label: string; description: string; permission: string; danger?: boolean }
> = {
  confirm: {
    label: 'Confirm order',
    description: 'You have checked the order with the customer (and the payment, for transfers).',
    permission: 'orders.write',
  },
  process: {
    label: 'Start packing',
    description: 'The order is being picked and packed.',
    permission: 'orders.write',
  },
  ship: {
    label: 'Mark as shipped',
    description:
      'Handed to the courier. Reserved stock becomes a sale; the customer sees the courier and tracking number.',
    permission: 'orders.write',
  },
  deliver: {
    label: 'Mark as delivered',
    description: 'The customer has the parcel. Cash on delivery orders become paid.',
    permission: 'orders.write',
  },
  cancel: {
    label: 'Cancel order',
    description: 'Releases the reserved stock and the discount code use. This cannot be undone.',
    permission: 'orders.write',
    danger: true,
  },
  return: {
    label: 'Record return',
    description: 'The parcel came back. Put the items back into stock unless they are damaged.',
    permission: 'orders.refund',
    danger: true,
  },
  refund: {
    label: 'Record refund',
    description: 'You have sent the money back. The payment is marked refunded.',
    permission: 'orders.refund',
    danger: true,
  },
};

/** Timeline wording for event types (`order.ship` → "Shipped"). Unknown types are shown as is. */
const EVENTS: Record<string, string> = {
  'order.placed': 'Order placed',
  'order.confirm': 'Confirmed',
  'order.process': 'Packing started',
  'order.ship': 'Shipped',
  'order.deliver': 'Delivered',
  'order.cancel': 'Cancelled',
  'order.cancelled': 'Cancelled by the customer',
  'order.return': 'Returned',
  'order.refund': 'Refunded',
  'payment.proof_uploaded': 'Payment screenshot uploaded',
  'payment.accepted': 'Payment accepted',
  'payment.rejected': 'Payment screenshot rejected',
  note: 'Note',
};

export const eventLabel = (type: string): string => EVENTS[type] ?? type;
