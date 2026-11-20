import type { OrderStatus, PaymentMethod, PaymentStatus } from '../../../generated/prisma/enums.js';

/*
 * Staff order workflow as a pure state machine (the service applies it under a row lock):
 *
 *   PENDING ──confirm──▶ CONFIRMED ──process──▶ PROCESSING
 *      │                    │  └────────ship────────┐  │
 *      │                    └──ship──▶ SHIPPED ◀────┘──┘ ──deliver──▶ DELIVERED
 *      └─cancel (PENDING / CONFIRMED / PROCESSING) ─▶ CANCELLED
 *   SHIPPED / DELIVERED ──return──▶ RETURNED
 *   PAID + (CANCELLED / RETURNED) ──refund──▶ payment REFUNDED
 *
 * Stock: placing an order reserves units; `ship` turns the reservation into a sale (on_hand ↓,
 * SALE movement); `cancel` releases the reservation; `return` can put units back (RETURN).
 */

export const staffActions = [
  'confirm',
  'process',
  'ship',
  'deliver',
  'cancel',
  'return',
  'refund',
] as const;
export type StaffAction = (typeof staffActions)[number];

export interface WorkflowOrder {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

export type TransitionCheck =
  | { allowed: true }
  | { allowed: false; code: 'INVALID_TRANSITION' | 'PAYMENT_NOT_VERIFIED'; detail: string };

const isTransfer = (method: PaymentMethod) => method !== 'COD';

const FROM: Record<StaffAction, readonly OrderStatus[]> = {
  confirm: ['PENDING'],
  process: ['CONFIRMED'],
  ship: ['CONFIRMED', 'PROCESSING'],
  deliver: ['SHIPPED'],
  cancel: ['PENDING', 'CONFIRMED', 'PROCESSING'],
  return: ['SHIPPED', 'DELIVERED'],
  refund: ['CANCELLED', 'RETURNED'],
};

/** Order status after the action (`refund` changes only the payment status). */
export const TO: Record<Exclude<StaffAction, 'refund'>, OrderStatus> = {
  confirm: 'CONFIRMED',
  process: 'PROCESSING',
  ship: 'SHIPPED',
  deliver: 'DELIVERED',
  cancel: 'CANCELLED',
  return: 'RETURNED',
};

export function checkTransition(order: WorkflowOrder, action: StaffAction): TransitionCheck {
  if (!FROM[action].includes(order.status)) {
    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      detail: `Cannot ${action} an order that is ${order.status.toLowerCase()}.`,
    };
  }
  // Transfers are confirmed (and shipped) only once the payment has been verified.
  if (
    (action === 'confirm' || action === 'ship') &&
    isTransfer(order.paymentMethod) &&
    order.paymentStatus !== 'PAID'
  ) {
    return {
      allowed: false,
      code: 'PAYMENT_NOT_VERIFIED',
      detail: 'Verify the transfer payment before confirming or shipping this order.',
    };
  }
  if (action === 'refund' && order.paymentStatus !== 'PAID') {
    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      detail: 'Only paid orders can be refunded.',
    };
  }
  return { allowed: true };
}

/** Every action currently possible (drives the admin panel's buttons). */
export const availableActions = (order: WorkflowOrder): StaffAction[] =>
  staffActions.filter((action) => checkTransition(order, action).allowed);

/** Payment proofs can be reviewed while the order is still being fulfilled. */
export const canReviewPayment = (order: WorkflowOrder) =>
  isTransfer(order.paymentMethod) &&
  ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status) &&
  order.paymentStatus !== 'PAID' &&
  order.paymentStatus !== 'REFUNDED';
