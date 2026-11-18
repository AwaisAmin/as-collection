export interface CartItem {
  productId: string;
  name: string;
  /** Unit price in PKR. */
  price: number;
  quantity: number;
  image?: string;
}
