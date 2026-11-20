import type { OrderDto, OrderSummaryDto, TrackedOrderDto } from '@as/contracts';

import type { Prisma } from '../../generated/prisma/client.js';

export const orderDetailSelect = {
  id: true,
  number: true,
  customerId: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  customerName: true,
  phone: true,
  email: true,
  shippingName: true,
  shippingPhone: true,
  shippingLine1: true,
  shippingLine2: true,
  shippingCity: true,
  shippingProvince: true,
  shippingPostalCode: true,
  notes: true,
  currency: true,
  subtotalMinor: true,
  discountMinor: true,
  shippingMinor: true,
  totalMinor: true,
  discountCode: true,
  courier: true,
  trackingNumber: true,
  placedAt: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      variantId: true,
      productName: true,
      variantTitle: true,
      sku: true,
      imageUrl: true,
      unitPriceMinor: true,
      compareAtPriceMinor: true,
      quantity: true,
      lineTotalMinor: true,
      product: { select: { slug: true } },
    },
  },
  events: {
    where: { isCustomerVisible: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { type: true, status: true, note: true, createdAt: true },
  },
  paymentProofs: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, method: true, status: true, reference: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

export type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

/** Payment proofs per order (re-uploads after a rejection, not an unlimited file drop). */
export const MAX_PAYMENT_PROOFS = 5;

export const canCancel = (o: Pick<OrderDetailRow, 'status' | 'paymentStatus'>) =>
  o.status === 'PENDING' && (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'FAILED');

export const canUploadPaymentProof = (
  o: Pick<OrderDetailRow, 'status' | 'paymentMethod' | 'paymentStatus'> & { proofCount: number },
) =>
  o.paymentMethod !== 'COD' &&
  (o.status === 'PENDING' || o.status === 'CONFIRMED') &&
  (o.paymentStatus === 'UNPAID' ||
    o.paymentStatus === 'FAILED' ||
    o.paymentStatus === 'AWAITING_VERIFICATION') &&
  o.proofCount < MAX_PAYMENT_PROOFS;

const iso = (d: Date | null) => d?.toISOString() ?? null;

const timelineOf = (row: OrderDetailRow) =>
  row.events.map((e) => ({
    type: e.type,
    status: e.status,
    note: e.note,
    at: e.createdAt.toISOString(),
  }));

const itemsOf = (row: OrderDetailRow) =>
  row.items.map((item) => ({
    variantId: item.variantId,
    productSlug: item.product?.slug ?? null,
    productName: item.productName,
    variantTitle: item.variantTitle,
    sku: item.sku,
    imageUrl: item.imageUrl,
    unitPriceMinor: item.unitPriceMinor,
    compareAtPriceMinor: item.compareAtPriceMinor,
    quantity: item.quantity,
    lineTotalMinor: item.lineTotalMinor,
  }));

/** The customer's own view (confirmation page, account): everything they entered. */
export function toOrderDto(row: OrderDetailRow): OrderDto {
  return {
    number: row.number,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    placedAt: row.placedAt.toISOString(),
    confirmedAt: iso(row.confirmedAt),
    shippedAt: iso(row.shippedAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    customer: { fullName: row.customerName, phone: row.phone, email: row.email },
    shipping: {
      fullName: row.shippingName,
      phone: row.shippingPhone,
      line1: row.shippingLine1,
      line2: row.shippingLine2,
      city: row.shippingCity,
      province: row.shippingProvince,
      postalCode: row.shippingPostalCode,
    },
    notes: row.notes,
    items: itemsOf(row),
    totals: {
      currency: row.currency,
      itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalMinor: row.subtotalMinor,
      discountMinor: row.discountMinor,
      shippingMinor: row.shippingMinor,
      totalMinor: row.totalMinor,
    },
    discountCode: row.discountCode,
    delivery: { courier: row.courier, trackingNumber: row.trackingNumber },
    paymentProofs: row.paymentProofs.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      reference: p.reference,
      uploadedAt: p.createdAt.toISOString(),
    })),
    timeline: timelineOf(row),
    actions: {
      canCancel: canCancel(row),
      canUploadPaymentProof: canUploadPaymentProof({
        ...row,
        proofCount: row.paymentProofs.length,
      }),
    },
  };
}

export type { OrderDto };

/**
 * Public tracking (order number + phone). The phone is known to many people, so this view has no
 * name, phone, email or street address — only progress, items and the delivery city.
 */
export function toTrackingDto(row: OrderDetailRow): TrackedOrderDto {
  return {
    number: row.number,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    placedAt: row.placedAt.toISOString(),
    shippedAt: iso(row.shippedAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    city: row.shippingCity,
    items: row.items.map((i) => ({
      productName: i.productName,
      variantTitle: i.variantTitle,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
    })),
    totalMinor: row.totalMinor,
    currency: row.currency,
    delivery: { courier: row.courier, trackingNumber: row.trackingNumber },
    timeline: timelineOf(row),
  };
}

export const orderSummarySelect = {
  number: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  placedAt: true,
  totalMinor: true,
  currency: true,
  items: {
    orderBy: { id: 'asc' },
    select: { productName: true, imageUrl: true, quantity: true },
  },
} satisfies Prisma.OrderSelect;

type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;

export const toOrderSummary = (row: OrderSummaryRow): OrderSummaryDto => ({
  number: row.number,
  status: row.status,
  paymentMethod: row.paymentMethod,
  paymentStatus: row.paymentStatus,
  placedAt: row.placedAt.toISOString(),
  totalMinor: row.totalMinor,
  currency: row.currency,
  itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
  preview: row.items.slice(0, 3).map((i) => ({ productName: i.productName, imageUrl: i.imageUrl })),
});
