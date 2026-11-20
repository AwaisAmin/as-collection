import type { OrderDto, QuoteDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import {
  quoteShippingRules,
  quoteSnapshots,
  toApiPaymentMethod,
  toOrder,
  toPaymentStatus,
} from './order-mappers';

const SITE = 'https://shop.example';

const order: OrderDto = {
  number: 'AS-261120-7K3QX',
  status: 'SHIPPED',
  paymentMethod: 'JAZZCASH',
  paymentStatus: 'PAID',
  placedAt: '2026-11-20T10:00:00.000Z',
  confirmedAt: null,
  shippedAt: '2026-11-21T10:00:00.000Z',
  deliveredAt: null,
  cancelledAt: null,
  customer: { fullName: 'Ayesha Malik', phone: '+923001234567', email: null },
  shipping: {
    fullName: 'Ayesha Malik',
    phone: '+923001234567',
    line1: 'House 12, Street 4',
    line2: null,
    city: 'Lahore',
    province: null,
    postalCode: '54000',
  },
  notes: 'Call before delivery',
  items: [
    {
      variantId: null,
      productSlug: 'ruby-lipstick',
      productName: 'Ruby Lipstick',
      variantTitle: 'Ruby Red',
      sku: 'MKUP-001-01',
      imageUrl: `${SITE}/images/ruby.jpg`,
      unitPriceMinor: 120_000,
      compareAtPriceMinor: 150_000,
      quantity: 2,
      lineTotalMinor: 240_000,
    },
  ],
  totals: {
    currency: 'PKR',
    itemCount: 2,
    subtotalMinor: 240_000,
    discountMinor: 20_000,
    shippingMinor: 25_000,
    totalMinor: 245_000,
  },
  discountCode: 'EID',
  delivery: { courier: 'TCS', trackingNumber: '123456' },
  paymentProofs: [
    { id: 'p1', method: 'JAZZCASH', status: 'ACCEPTED', reference: 'TX-9', uploadedAt: '' },
  ],
  timeline: [
    { type: 'order.placed', status: 'PENDING', note: 'Order placed.', at: '2026-11-20T10:00:00Z' },
    { type: 'x', status: null, note: null, at: '2026-11-20T11:00:00Z' },
  ],
  actions: { canCancel: false, canUploadPaymentProof: false },
};

describe('order mappers', () => {
  it('maps payment choices and statuses both ways', () => {
    expect(toApiPaymentMethod('cod', undefined)).toBe('COD');
    expect(toApiPaymentMethod('bank_transfer', 'easypaisa')).toBe('EASYPAISA');
    expect(toApiPaymentMethod('bank_transfer', 'bank')).toBe('BANK_TRANSFER');
    expect(toPaymentStatus('COD', 'UNPAID')).toBe('pay_on_delivery');
    expect(toPaymentStatus('BANK_TRANSFER', 'UNPAID')).toBe('awaiting_payment');
    expect(toPaymentStatus('JAZZCASH', 'FAILED')).toBe('payment_failed');
  });

  it('turns an API order into the storefront order', () => {
    const mapped = toOrder(order, SITE);
    expect(mapped).toMatchObject({
      orderNumber: 'AS-261120-7K3QX',
      status: 'shipped',
      customer: { fullName: 'Ayesha Malik', phone: '03001234567' },
      shipping: {
        city: 'Lahore',
        address: 'House 12, Street 4',
        postalCode: '54000',
        notes: 'Call before delivery',
      },
      payment: {
        method: 'bank_transfer',
        channel: 'jazzcash',
        status: 'paid',
        transactionRef: 'TX-9',
        proofStatus: 'accepted',
      },
      totals: {
        itemCount: 2,
        subtotal: 2400,
        savings: 600,
        discount: 200,
        shipping: 250,
        total: 2450,
      },
      delivery: { courier: 'TCS', trackingNumber: '123456' },
      timeline: [{ note: 'Order placed.', at: '2026-11-20T10:00:00Z' }],
    });
    expect(mapped.lines[0]).toMatchObject({
      variantId: 'MKUP-001-01',
      variantTitle: 'Ruby Red',
      image: { src: '/images/ruby.jpg' },
      price: 1200,
      lineTotal: 2400,
    });
  });

  it('reads cart snapshots and delivery rules from a refused checkout', () => {
    const quote = {
      lines: [
        {
          variantId: 'v1',
          unitPriceMinor: 99_000,
          compareAtPriceMinor: null,
          availableQuantity: 3,
          problem: null,
        },
        {
          variantId: 'v2',
          unitPriceMinor: 50_000,
          compareAtPriceMinor: null,
          availableQuantity: 4,
          problem: 'UNAVAILABLE',
        },
      ],
      shippingMinor: 30_000,
      freeShippingThresholdMinor: 300_000,
    } as unknown as QuoteDto;
    expect(quoteSnapshots(quote)).toEqual([
      { variantId: 'v1', price: 990, stock: 3 },
      { variantId: 'v2', price: 500, stock: 0 },
    ]);
    expect(quoteShippingRules(quote, 250)).toEqual({
      shippingFee: 300,
      freeShippingThreshold: 3000,
    });
    expect(quoteShippingRules({ ...quote, shippingMinor: 0 }, 250).shippingFee).toBe(250);
  });
});
