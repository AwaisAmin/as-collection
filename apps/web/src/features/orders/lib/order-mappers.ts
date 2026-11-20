import type {
  OrderDto,
  OrderEventDto,
  OrderStatus as ApiOrderStatus,
  OrderSummaryDto,
  PaymentMethod as ApiPaymentMethod,
  PaymentStatus as ApiPaymentStatus,
  QuoteDto,
  TrackedOrderDto,
} from '@as/contracts';

import type { TransferChannel } from '@/config/payments';
import { toImageSrc, toRupees } from '@/features/catalog/services/api-mappers';
import type { ProductImage, VariantSnapshot } from '@/features/catalog/types';
import { normalizePkMobile } from '@/lib/utils/phone';

import type {
  Order,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  PaymentStatus,
  TrackedOrder,
} from '../types';

/* API orders (UPPERCASE enums, paisa, E.164) ↔ the storefront's. Pure, unit-tested. */

export const toOrderStatus = (status: ApiOrderStatus): OrderStatus =>
  status.toLowerCase() as OrderStatus;

/** The storefront's payment choice → the API's method. */
export function toApiPaymentMethod(
  method: PaymentMethod,
  channel: TransferChannel | undefined,
): ApiPaymentMethod {
  if (method === 'cod') return 'COD';
  if (channel === 'jazzcash') return 'JAZZCASH';
  if (channel === 'easypaisa') return 'EASYPAISA';
  return 'BANK_TRANSFER';
}

const CHANNEL: Partial<Record<ApiPaymentMethod, TransferChannel>> = {
  BANK_TRANSFER: 'bank',
  JAZZCASH: 'jazzcash',
  EASYPAISA: 'easypaisa',
};

export function toPaymentStatus(method: ApiPaymentMethod, status: ApiPaymentStatus): PaymentStatus {
  switch (status) {
    case 'UNPAID':
      return method === 'COD' ? 'pay_on_delivery' : 'awaiting_payment';
    case 'AWAITING_VERIFICATION':
      return 'awaiting_verification';
    case 'FAILED':
      return 'payment_failed';
    case 'PAID':
      return 'paid';
    case 'REFUNDED':
      return 'refunded';
  }
}

const localPhone = (e164: string) => normalizePkMobile(e164) ?? e164;

const imageOf = (url: string | null, alt: string, siteOrigin: string): ProductImage =>
  url ? { src: toImageSrc(url, siteOrigin), alt } : { src: '/images/hero-model.jpg', alt };

/** Customer-visible events with text, oldest first. */
const timelineOf = (events: readonly OrderEventDto[]) =>
  events.flatMap((e) => (e.note ? [{ note: e.note, at: e.at }] : []));

const deliveryOf = ({ courier, trackingNumber }: OrderDto['delivery']) =>
  courier || trackingNumber
    ? { ...(courier ? { courier } : {}), ...(trackingNumber ? { trackingNumber } : {}) }
    : undefined;

export function toOrder(dto: OrderDto, siteOrigin: string): Order {
  const lines = dto.items.map((item) => ({
    variantId: item.variantId ?? item.sku,
    slug: item.productSlug ?? '',
    name: item.productName,
    sku: item.sku,
    options: {},
    ...(item.variantTitle ? { variantTitle: item.variantTitle } : {}),
    image: imageOf(item.imageUrl, item.productName, siteOrigin),
    price: toRupees(item.unitPriceMinor),
    ...(item.compareAtPriceMinor ? { compareAtPrice: toRupees(item.compareAtPriceMinor) } : {}),
    quantity: item.quantity,
    lineTotal: toRupees(item.lineTotalMinor),
  }));
  const savings = lines.reduce(
    (sum, l) => sum + Math.max(0, (l.compareAtPrice ?? l.price) - l.price) * l.quantity,
    0,
  );
  const latestProof = dto.paymentProofs[0];
  const channel = CHANNEL[dto.paymentMethod];
  const delivery = deliveryOf(dto.delivery);
  return {
    orderNumber: dto.number,
    createdAt: dto.placedAt,
    status: toOrderStatus(dto.status),
    customer: {
      fullName: dto.customer.fullName,
      phone: localPhone(dto.customer.phone),
      ...(dto.customer.email ? { email: dto.customer.email } : {}),
    },
    shipping: {
      city: dto.shipping.city,
      address: [dto.shipping.line1, dto.shipping.line2].filter(Boolean).join(', '),
      ...(dto.shipping.postalCode ? { postalCode: dto.shipping.postalCode } : {}),
      ...(dto.notes ? { notes: dto.notes } : {}),
    },
    payment: {
      method: dto.paymentMethod === 'COD' ? 'cod' : 'bank_transfer',
      status: toPaymentStatus(dto.paymentMethod, dto.paymentStatus),
      ...(channel ? { channel } : {}),
      ...(latestProof?.reference ? { transactionRef: latestProof.reference } : {}),
      ...(latestProof
        ? { proofStatus: latestProof.status.toLowerCase() as 'pending' | 'accepted' | 'rejected' }
        : {}),
    },
    lines,
    totals: {
      itemCount: dto.totals.itemCount,
      subtotal: toRupees(dto.totals.subtotalMinor),
      savings,
      ...(dto.totals.discountMinor ? { discount: toRupees(dto.totals.discountMinor) } : {}),
      shipping: toRupees(dto.totals.shippingMinor),
      total: toRupees(dto.totals.totalMinor),
    },
    ...(delivery ? { delivery } : {}),
    timeline: timelineOf(dto.timeline),
    actions: dto.actions,
  };
}

export function toTrackedOrder(dto: TrackedOrderDto, siteOrigin: string): TrackedOrder {
  const delivery = deliveryOf(dto.delivery);
  return {
    orderNumber: dto.number,
    status: toOrderStatus(dto.status),
    paymentStatus: toPaymentStatus(dto.paymentMethod, dto.paymentStatus),
    createdAt: dto.placedAt,
    city: dto.city,
    items: dto.items.map((i) => ({
      name: i.productName,
      ...(i.variantTitle ? { variantTitle: i.variantTitle } : {}),
      image: imageOf(i.imageUrl, i.productName, siteOrigin),
      quantity: i.quantity,
    })),
    itemCount: dto.items.reduce((sum, i) => sum + i.quantity, 0),
    total: toRupees(dto.totalMinor),
    ...(delivery ? { delivery } : {}),
    timeline: timelineOf(dto.timeline),
  };
}

export const toOrderSummary = (dto: OrderSummaryDto, siteOrigin: string): OrderSummary => ({
  orderNumber: dto.number,
  status: toOrderStatus(dto.status),
  paymentStatus: toPaymentStatus(dto.paymentMethod, dto.paymentStatus),
  createdAt: dto.placedAt,
  itemCount: dto.itemCount,
  total: toRupees(dto.totalMinor),
  previews: dto.preview.map((p) => imageOf(p.imageUrl, p.productName, siteOrigin)),
});

/** A quote's lines as cart snapshots (so the cart can show what changed). */
export const quoteSnapshots = (quote: QuoteDto): VariantSnapshot[] =>
  quote.lines.map((l) => ({
    variantId: l.variantId,
    price: toRupees(l.unitPriceMinor),
    ...(l.compareAtPriceMinor ? { compareAtPrice: toRupees(l.compareAtPriceMinor) } : {}),
    stock: l.problem === 'UNAVAILABLE' ? 0 : l.availableQuantity,
  }));

/**
 * The delivery rules a quote implies: the threshold is explicit; the fee is what the quote
 * charged, or `fallbackFee` when this cart already ships free.
 */
export const quoteShippingRules = (quote: QuoteDto, fallbackFee: number) => ({
  freeShippingThreshold: toRupees(quote.freeShippingThresholdMinor),
  shippingFee: quote.shippingMinor > 0 ? toRupees(quote.shippingMinor) : fallbackFee,
});
