import type { TransferChannel } from '@/config/payments';
import type { ProductImage, VariantSnapshot } from '@/features/catalog/types';

export type PaymentMethod = 'cod' | 'bank_transfer';

export type OrderStatus =
  'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentStatus =
  /** COD — collected by the courier. */
  | 'pay_on_delivery'
  /** Transfer screenshot received, staff must verify. */
  | 'awaiting_verification'
  | 'paid'
  | 'refunded';

export interface OrderLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  options: Readonly<Record<string, string>>;
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
  shipping: number;
  total: number;
}

export interface Order {
  orderNumber: string;
  /** Secret for the customer's confirmation link (orders aren't guessable by number alone). */
  accessKey: string;
  /** Client-generated id that makes "place order" idempotent. */
  checkoutId: string;
  createdAt: string;
  status: OrderStatus;
  customer: { fullName: string; phone: string; email?: string };
  shipping: { city: string; address: string; postalCode?: string; notes?: string };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    channel?: TransferChannel;
    transactionRef?: string;
    /** Uploaded proof metadata (file goes to object storage once the API exists). */
    screenshot?: { name: string; size: number; type: string };
  };
  lines: readonly OrderLine[];
  totals: OrderTotals;
}

export interface PlaceOrderInput {
  checkoutId: string;
  customer: Order['customer'];
  shipping: Order['shipping'];
  payment: {
    method: PaymentMethod;
    channel?: TransferChannel;
    transactionRef?: string;
    screenshot?: { name: string; size: number; type: string };
  };
  lines: readonly { variantId: string; quantity: number }[];
  /** Total the shopper saw — if the server total differs, they must re-confirm. */
  expectedTotal: number;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      reason: 'stock_changed' | 'price_changed';
      /** Fresh data so the client can update the cart. */
      snapshots: VariantSnapshot[];
    };
