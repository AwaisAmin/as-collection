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
  /** Stock available when added (capped server-side again at checkout). */
  maxQuantity: number;
}

export type NewCartItem = Omit<CartItem, 'quantity'>;

export interface AddToCartResult {
  /** Units actually added (may be less than requested when stock-capped). */
  added: number;
  /** True when the request hit the stock limit. */
  capped: boolean;
}
