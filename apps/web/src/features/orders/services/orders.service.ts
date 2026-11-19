import 'server-only';

import { computeCartTotals } from '@/features/cart/lib/cart-totals';
import type { CartItem } from '@/features/cart/types';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { normalizePkMobile } from '@/lib/utils/phone';

import { generateAccessKey, generateOrderNumber } from '../lib/order-number';
import type { Order, OrderLine, PlaceOrderInput, PlaceOrderResult } from '../types';

/** Port: order placement + lookup. */
export interface OrdersService {
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  /** Customer view (confirmation page) — requires the secret access key. */
  getOrderForCustomer(orderNumber: string, accessKey: string): Promise<Order | null>;
  /** Public tracking — order number + the phone used at checkout. */
  findOrderByNumberAndPhone(orderNumber: string, phone: string): Promise<Order | null>;
}

/*
 * Adapter: in-memory mock. Kept on globalThis so orders survive dev hot-reloads.
 * The NestJS API replaces this (DB transaction: re-price, reserve stock, create order).
 */
const store: Map<string, Order> = ((
  globalThis as { __asOrders?: Map<string, Order> }
).__asOrders ??= new Map());

async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  // Idempotency: a retried/double-submitted checkout returns the original order.
  const existing = [...store.values()].find((o) => o.checkoutId === input.checkoutId);
  if (existing) return { ok: true, order: existing };

  // Re-price and re-check stock from the source of truth — never trust client prices.
  const details = await catalogService.getVariantDetails(input.lines.map((l) => l.variantId));
  const byId = new Map(details.map((d) => [d.variantId, d]));
  const snapshots = details.map(({ variantId, price, compareAtPrice, stock }) => ({
    variantId,
    price,
    compareAtPrice,
    stock,
  }));

  const stockProblem = input.lines.some((l) => {
    const d = byId.get(l.variantId);
    return !d || d.stock < l.quantity;
  });
  if (stockProblem) return { ok: false, reason: 'stock_changed', snapshots };

  const lines: OrderLine[] = input.lines.map((l) => {
    const d = byId.get(l.variantId)!;
    return {
      variantId: d.variantId,
      productId: d.productId,
      slug: d.slug,
      name: d.name,
      sku: d.sku,
      options: d.options,
      image: d.image,
      price: d.price,
      compareAtPrice: d.compareAtPrice,
      quantity: l.quantity,
      lineTotal: d.price * l.quantity,
    };
  });

  const asCartItems: CartItem[] = lines.map((l) => ({ ...l, maxQuantity: l.quantity }));
  const t = computeCartTotals(asCartItems);
  if (t.total !== input.expectedTotal) return { ok: false, reason: 'price_changed', snapshots };

  const order: Order = {
    orderNumber: generateOrderNumber(),
    accessKey: generateAccessKey(),
    checkoutId: input.checkoutId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer: input.customer,
    shipping: input.shipping,
    payment: {
      ...input.payment,
      status: input.payment.method === 'cod' ? 'pay_on_delivery' : 'awaiting_verification',
    },
    lines,
    totals: {
      itemCount: t.itemCount,
      subtotal: t.subtotal,
      savings: t.savings,
      shipping: t.shipping,
      total: t.total,
    },
  };
  store.set(order.orderNumber, order);
  return { ok: true, order };
}

async function getOrderForCustomer(orderNumber: string, accessKey: string) {
  const order = store.get(orderNumber);
  return order && order.accessKey === accessKey ? order : null;
}

async function findOrderByNumberAndPhone(orderNumber: string, phone: string) {
  const order = store.get(orderNumber.trim().toUpperCase());
  const normalized = normalizePkMobile(phone);
  return order && normalized && order.customer.phone === normalized ? order : null;
}

export const ordersService: OrdersService = {
  placeOrder,
  getOrderForCustomer,
  findOrderByNumberAndPhone,
};
