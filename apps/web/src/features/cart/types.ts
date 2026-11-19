/** A cart line = one product variant (size/shade). Snapshot of display data at add time. */
export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  /** e.g. { Size: 'M' } — empty for single-variant products. */
  options: Readonly<Record<string, string>>;
  image: { src: string; alt: string };
  /** Unit price in whole PKR. */
  price: number;
  compareAtPrice?: number;
  quantity: number;
  /** Stock available at last check (re-validated on the cart page and at checkout). */
  maxQuantity: number;
  /** Set when the variant was discontinued or sold out at the last check. */
  unavailable?: boolean;
}

export type NewCartItem = Omit<CartItem, 'quantity' | 'unavailable'>;

export interface AddToCartResult {
  /** Units actually added (may be less than requested when stock-capped). */
  added: number;
  /** True when the request hit the stock limit. */
  capped: boolean;
}

export type { VariantSnapshot } from '@/features/catalog/types';

export type CartChange =
  | { kind: 'price'; name: string; from: number; to: number }
  | { kind: 'quantity'; name: string; to: number }
  | { kind: 'unavailable'; name: string };
