import 'server-only';

import { mockAuthService } from '@/features/auth/services/auth.mock';
import { computeCartTotals } from '@/features/cart/lib/cart-totals';
import type { CartItem } from '@/features/cart/types';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { normalizePkMobile } from '@/lib/utils/phone';

import { generateAccessKey, generateOrderNumber } from '../lib/order-number';
import type {
  Order,
  OrderAccess,
  OrderLine,
  OrderSummary,
  PlaceOrderInput,
  PlaceOrderResult,
  TrackedOrder,
} from '../types';
import type { OrderActionResult, OrdersService } from './orders.service';

interface CustomerRef {
  userId: string;
  /** Verified phone ('' for Google-only accounts). */
  phone: string;
}

const belongsTo = (order: Order, c: CustomerRef) =>
  order.userId === c.userId || (c.phone !== '' && order.customer.phone === c.phone);

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
  if (existing) {
    return { ok: true, order: existing, accessKey: existing.accessKey ?? '', proofUploaded: true };
  }

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

  const asCartItems: CartItem[] = lines.map((l) => ({
    ...l,
    productId: l.productId ?? '',
    maxQuantity: l.quantity,
  }));
  const t = computeCartTotals(asCartItems);
  if (t.total !== input.expectedTotal) return { ok: false, reason: 'price_changed', snapshots };

  const order: Order = {
    orderNumber: generateOrderNumber(),
    accessKey: generateAccessKey(),
    checkoutId: input.checkoutId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer: input.customer,
    shipping: input.shipping,
    payment: {
      method: input.payment.method,
      ...(input.payment.channel ? { channel: input.payment.channel } : {}),
      ...(input.payment.transactionRef ? { transactionRef: input.payment.transactionRef } : {}),
      ...(input.payment.screenshot
        ? {
            screenshot: {
              name: input.payment.screenshot.name.slice(0, 120),
              size: input.payment.screenshot.size,
              type: input.payment.screenshot.type,
            },
          }
        : {}),
      status: input.payment.method === 'cod' ? 'pay_on_delivery' : 'awaiting_verification',
    },
    actions: { canCancel: true, canUploadPaymentProof: false },
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
  return { ok: true, order, accessKey: order.accessKey ?? '', proofUploaded: true };
}

/** The signed-in customer behind a mock session token. */
async function customerOf(token: string): Promise<CustomerRef | null> {
  const user = await mockAuthService.getUser(token);
  return user ? { userId: user.id, phone: user.phone } : null;
}

async function getOrder(orderNumber: string, access: OrderAccess): Promise<Order | null> {
  const order = store.get(orderNumber);
  if (!order) return null;
  if ('accessKey' in access) return order.accessKey === access.accessKey ? order : null;
  const customer = await customerOf(access.token);
  return customer && belongsTo(order, customer) ? order : null;
}

function trackOrder(orderNumber: string, phone: string): TrackedOrder | null {
  const order = store.get(orderNumber.trim().toUpperCase());
  const normalized = normalizePkMobile(phone);
  if (!order || !normalized || order.customer.phone !== normalized) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.payment.status,
    createdAt: order.createdAt,
    city: order.shipping.city,
    items: order.lines.map((l) => ({ name: l.name, image: l.image, quantity: l.quantity })),
    itemCount: order.totals.itemCount,
    total: order.totals.total,
    timeline: [],
  };
}

async function listOrders(token: string): Promise<OrderSummary[]> {
  const customer = await customerOf(token);
  if (!customer) return [];
  return [...store.values()]
    .filter((o) => belongsTo(o, customer))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.payment.status,
      createdAt: o.createdAt,
      itemCount: o.totals.itemCount,
      total: o.totals.total,
      previews: o.lines.slice(0, 3).map((l) => l.image),
    }));
}

async function cancelOrder(orderNumber: string, access: OrderAccess): Promise<OrderActionResult> {
  const order = await getOrder(orderNumber, access);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'pending')
    return { ok: false, error: 'This order can no longer be cancelled.' };
  order.status = 'cancelled';
  order.actions = { canCancel: false, canUploadPaymentProof: false };
  return { ok: true, order };
}

async function uploadPaymentProof(
  orderNumber: string,
  access: OrderAccess,
  file: File,
  reference: string | undefined,
): Promise<OrderActionResult> {
  const order = await getOrder(orderNumber, access);
  if (!order) return { ok: false, error: 'Order not found.' };
  order.payment = {
    ...order.payment,
    status: 'awaiting_verification',
    screenshot: { name: file.name.slice(0, 120), size: file.size, type: file.type },
    ...(reference ? { transactionRef: reference } : {}),
  };
  return { ok: true, order };
}

/* Adapter: in-memory mock (`MOCK_API=true`). */
export const mockOrdersService: OrdersService = {
  placeOrder: (input) => placeOrder(input),
  getOrder,
  trackOrder: async (number, phone) => trackOrder(number, phone),
  listOrders,
  cancelOrder,
  uploadPaymentProof,
};
