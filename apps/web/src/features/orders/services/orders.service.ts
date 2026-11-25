import 'server-only';

import type {
  Order,
  OrderAccess,
  OrderSummary,
  PlaceOrderInput,
  PlaceOrderResult,
  TrackedOrder,
} from '../types';
import { apiOrdersService } from './orders.api';

/** Who is asking (signed-in session, IP and browser for the API's limits). */
export interface RequestContext {
  token: string | null;
  ip: string | null;
  userAgent: string | null;
}

export type OrderActionResult = { ok: true; order: Order } | { ok: false; error: string };

/** A discount code checked against the cart (amounts in rupees). */
export type DiscountCheck =
  | { ok: true; code: string; discount: number; freeShipping: boolean; total: number }
  | { ok: false; code: string; message: string };

/** Port: checkout and the customer's orders. */
export interface OrdersService {
  /** Prices the cart with a discount code (nothing is reserved). */
  checkDiscount(
    lines: readonly { variantId: string; quantity: number }[],
    code: string,
    ctx: RequestContext,
  ): Promise<DiscountCheck>;
  /** Re-prices and reserves stock server-side; uploads the transfer screenshot when given. */
  placeOrder(input: PlaceOrderInput, ctx: RequestContext): Promise<PlaceOrderResult>;
  /** The full order for its owner (confirmation-page access key, or the signed-in session). */
  getOrder(orderNumber: string, access: OrderAccess): Promise<Order | null>;
  /** Public tracking — order number + the phone used at checkout; no personal details. */
  trackOrder(orderNumber: string, phone: string, ctx: RequestContext): Promise<TrackedOrder | null>;
  /** Account history: orders placed while signed in + guest orders with the verified phone. */
  listOrders(token: string): Promise<OrderSummary[]>;
  /** Cancels a pending, unpaid order (stock is released). */
  cancelOrder(orderNumber: string, access: OrderAccess): Promise<OrderActionResult>;
  /** Transfer screenshot (again, after a rejection). */
  uploadPaymentProof(
    orderNumber: string,
    access: OrderAccess,
    file: File,
    reference: string | undefined,
  ): Promise<OrderActionResult>;
}

/** The NestJS checkout and orders API. */
export const ordersService: OrdersService = apiOrdersService;
