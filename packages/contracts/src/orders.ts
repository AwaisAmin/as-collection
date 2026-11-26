/* Checkout (quotes, placing orders) and the customer's view of their orders. */

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'JAZZCASH' | 'EASYPAISA';

export type PaymentStatus = 'UNPAID' | 'AWAITING_VERIFICATION' | 'PAID' | 'REFUNDED' | 'FAILED';

export type PaymentProofStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

// ─── Quote (`POST /checkout/quote`) ───

export type LineProblem = 'UNAVAILABLE' | 'INSUFFICIENT_STOCK';

export interface QuoteLineDto {
  variantId: string;
  quantity: number;
  productId: string | null;
  productSlug: string | null;
  productName: string | null;
  variantTitle: string | null;
  sku: string | null;
  image: { url: string; alt: string } | null;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  lineTotalMinor: number;
  /** Capped (exact stock levels are not exposed). */
  availableQuantity: number;
  problem: LineProblem | null;
}

export type DiscountRejection =
  'NOT_FOUND' | 'INACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'MIN_SUBTOTAL' | 'USAGE_LIMIT';

export type DiscountResultDto =
  | { applied: true; code: string; discountMinor: number; freeShipping: boolean }
  | { applied: false; code: string; reason: DiscountRejection; minSubtotalMinor?: number };

export interface QuoteDto {
  lines: QuoteLineDto[];
  itemCount: number;
  subtotalMinor: number;
  /** Compare-at savings already in the prices. */
  savingsMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: 'PKR';
  discount: DiscountResultDto | null;
  freeShippingThresholdMinor: number;
  freeShippingRemainingMinor: number;
  /** No line has a problem and the cart is not empty. */
  purchasable: boolean;
}

// ─── Orders ───

export interface OrderItemDto {
  /** Null when the variant was deleted later (the snapshot below remains). */
  variantId: string | null;
  productSlug: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  quantity: number;
  lineTotalMinor: number;
}

/** Customer-visible order events (internal staff notes never appear). */
export interface OrderEventDto {
  type: string;
  status: OrderStatus | null;
  note: string | null;
  at: string;
}

export interface DeliveryDto {
  courier: string | null;
  trackingNumber: string | null;
}

/** The customer's own view (confirmation page, account). */
export interface OrderDto {
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  placedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
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
  notes: string | null;
  items: OrderItemDto[];
  totals: {
    currency: string;
    itemCount: number;
    subtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    totalMinor: number;
  };
  discountCode: string | null;
  delivery: DeliveryDto;
  paymentProofs: {
    id: string;
    method: PaymentMethod;
    status: PaymentProofStatus;
    reference: string | null;
    /** Staff's reason, shown to the customer when the screenshot was not accepted. */
    rejectionReason: string | null;
    uploadedAt: string;
  }[];
  timeline: OrderEventDto[];
  actions: { canCancel: boolean; canUploadPaymentProof: boolean };
}

/** `POST /orders` (201, or 200 when an idempotent retry returns the original). */
export interface PlacedOrderDto {
  order: OrderDto;
  /** Secret for the confirmation link; guests need it to view, cancel or pay the order. */
  accessKey: string;
}

/**
 * Public tracking (`POST /orders/track`, number + checkout phone): progress only — no name,
 * phone, email or street address.
 */
export interface TrackedOrderDto {
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  city: string;
  items: {
    productName: string;
    variantTitle: string | null;
    imageUrl: string | null;
    quantity: number;
  }[];
  totalMinor: number;
  currency: string;
  delivery: DeliveryDto;
  timeline: OrderEventDto[];
}

/** One row of `GET /account/orders`. */
export interface OrderSummaryDto {
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  placedAt: string;
  totalMinor: number;
  currency: string;
  itemCount: number;
  preview: { productName: string; imageUrl: string | null }[];
}

export interface OrderPageDto {
  items: OrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
