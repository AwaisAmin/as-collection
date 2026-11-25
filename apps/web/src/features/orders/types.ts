import type { TransferChannel } from '@/config/payments';
import type { ProductImage, VariantSnapshot } from '@/features/catalog/types';

export type PaymentMethod = 'cod' | 'bank_transfer';

export type OrderStatus =
  'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export type PaymentStatus =
  /** COD — collected by the courier. */
  | 'pay_on_delivery'
  /** Transfer chosen, screenshot not uploaded yet. */
  | 'awaiting_payment'
  /** Transfer screenshot received, staff must verify. */
  | 'awaiting_verification'
  /** The screenshot was rejected; a new one is needed. */
  | 'payment_failed'
  | 'paid'
  | 'refunded';

export interface OrderLine {
  /** Variant id (or the SKU when that variant no longer exists). */
  variantId: string;
  productId?: string;
  slug: string;
  name: string;
  sku: string;
  options: Readonly<Record<string, string>>;
  /** Variant label from the order snapshot ("M", "Ruby Red") when options aren't itemised. */
  variantTitle?: string;
  image: ProductImage;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderTotals {
  itemCount: number;
  subtotal: number;
  savings: number;
  /** Coupon discount. */
  discount?: number;
  shipping: number;
  total: number;
}

export interface Order {
  orderNumber: string;
  /** Set when placed while signed in. Guest orders link to accounts by verified phone. */
  userId?: string;
  /** Secret for the customer's confirmation link (orders aren't guessable by number alone). */
  accessKey?: string;
  /** Client-generated id that makes "place order" idempotent. */
  checkoutId?: string;
  createdAt: string;
  status: OrderStatus;
  customer: { fullName: string; phone: string; email?: string };
  shipping: { city: string; address: string; postalCode?: string; notes?: string };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    channel?: TransferChannel;
    transactionRef?: string;
    /** Uploaded proof metadata (mock adapter). */
    screenshot?: { name: string; size: number; type: string };
    /** Latest screenshot's review state (API). */
    proofStatus?: 'pending' | 'accepted' | 'rejected';
  };
  lines: readonly OrderLine[];
  totals: OrderTotals;
  delivery?: { courier?: string; trackingNumber?: string };
  /** Customer-visible progress messages, oldest first. */
  timeline?: readonly { note: string; at: string }[];
  /** What the customer may do now. */
  actions?: { canCancel: boolean; canUploadPaymentProof: boolean };
}

/** Public tracking view (number + phone): progress only, no personal details. */
export interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  city: string;
  items: readonly { name: string; variantTitle?: string; image: ProductImage; quantity: number }[];
  itemCount: number;
  total: number;
  delivery?: { courier?: string; trackingNumber?: string };
  timeline: readonly { note: string; at: string }[];
}

/** One row in the account's order history. */
export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  itemCount: number;
  total: number;
  previews: readonly ProductImage[];
}

/** How a request proves it may see or change an order. */
export type OrderAccess = { accessKey: string } | { token: string };

export interface PlaceOrderInput {
  checkoutId: string;
  userId?: string;
  customer: Order['customer'];
  shipping: Order['shipping'];
  payment: {
    method: PaymentMethod;
    channel?: TransferChannel;
    transactionRef?: string;
    /** The payment screenshot itself (already checked by type and size). */
    screenshot?: File;
  };
  lines: readonly { variantId: string; quantity: number }[];
  /** Discount code the shopper applied (checked again by the API). */
  discountCode?: string;
  /** Total the shopper saw — if the server total differs, they must re-confirm. */
  expectedTotal: number;
}

export type PlaceOrderResult =
  | {
      ok: true;
      order: Order;
      accessKey: string;
      /** False when the order was placed but the screenshot upload failed (retry from the confirmation page). */
      proofUploaded: boolean;
    }
  | {
      ok: false;
      reason: 'stock_changed' | 'price_changed' | 'discount_invalid';
      /** Fresh data so the client can update the cart. */
      snapshots: VariantSnapshot[];
      /** The store's current delivery rules (when they changed, totals differ). */
      shipping?: { shippingFee: number; freeShippingThreshold: number };
    };
