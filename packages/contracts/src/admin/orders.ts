/* Staff order management (`/admin/orders`). */
import type { OrderStatus, PaymentMethod, PaymentProofStatus, PaymentStatus } from '../orders.js';
import type { AdminPage, StaffRefDto } from './common.js';

/** What staff can do to an order next; the API lists only the currently allowed ones. */
export type StaffOrderAction =
  'confirm' | 'process' | 'ship' | 'deliver' | 'cancel' | 'return' | 'refund';

export type ActorType = 'SYSTEM' | 'CUSTOMER' | 'STAFF';

export interface AdminOrderListItemDto {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  phone: string;
  city: string;
  totalMinor: number;
  currency: string;
  lineCount: number;
  placedAt: string;
}

export type AdminOrderListDto = AdminPage<AdminOrderListItemDto>;

export interface AdminOrderCountsDto {
  byStatus: Partial<Record<OrderStatus, number>>;
  awaitingPaymentReview: number;
  toConfirm: number;
  toShip: number;
}

export interface AdminOrderItemDto {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  quantity: number;
  lineTotalMinor: number;
}

export interface AdminOrderEventDto {
  id: string;
  /** `order.placed`, `order.ship`, `payment.accepted`, `note`… */
  type: string;
  status: OrderStatus | null;
  note: string | null;
  customerVisible: boolean;
  actorType: ActorType;
  actor: StaffRefDto | null;
  at: string;
}

export interface AdminPaymentProofDto {
  id: string;
  method: PaymentMethod;
  status: PaymentProofStatus;
  reference: string | null;
  amountMinor: number | null;
  /** The amount the customer entered differs from the order total. */
  amountMismatch: boolean;
  note: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: StaffRefDto | null;
}

export interface AdminOrderDto {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerId: string | null;
  customer: { fullName: string; phone: string; email: string | null };
  shipping: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string | null;
  };
  /** The customer's own note at checkout. */
  notes: string | null;
  items: AdminOrderItemDto[];
  totals: {
    currency: string;
    itemCount: number;
    subtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    totalMinor: number;
  };
  discountCode: string | null;
  delivery: { courier: string | null; trackingNumber: string | null };
  placedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  timeline: AdminOrderEventDto[];
  paymentProofs: AdminPaymentProofDto[];
  actions: StaffOrderAction[];
  canReviewPayment: boolean;
}

/** `GET /admin/orders/:number/payment-proofs/:id/url` — a short-lived signed link. */
export interface SignedUrlDto {
  url: string;
  expiresAt: string;
}
