import { z } from 'zod';

import { pkMobileSchema } from '../../common/phone.js';
import { MAX_QUANTITY_PER_LINE } from './pricing.js';

const text = (min: number, max: number, message?: string) =>
  z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(min, message).max(max));

const optionalText = (max: number) =>
  z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .pipe(z.string().max(max))
    .transform((v) => (v === '' ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const cartLinesSchema = z
  .array(
    z.strictObject({
      variantId: z.uuid(),
      quantity: z.int().min(1).max(MAX_QUANTITY_PER_LINE),
    }),
  )
  .min(1, 'Your cart is empty.')
  .max(50);

export const discountCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{2,40}$/, 'Enter a valid coupon code.')
  .transform((v) => v.toUpperCase());

export const quoteSchema = z.strictObject({
  lines: cartLinesSchema,
  discountCode: discountCodeSchema.optional(),
});

export const paymentMethods = ['COD', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA'] as const;

export const placeOrderSchema = z.strictObject({
  customer: z.strictObject({
    fullName: text(2, 120, 'Please enter your full name.'),
    phone: pkMobileSchema,
    email: z
      .union([z.literal(''), z.email().max(254)])
      .transform((v) => (v === '' ? null : v.toLowerCase()))
      .nullish()
      .transform((v) => v ?? null),
  }),
  shipping: z.strictObject({
    /** Recipient, if not the customer (a gift). */
    fullName: optionalText(120),
    phone: pkMobileSchema.nullish().transform((v) => v ?? null),
    line1: text(5, 200, 'Please enter the full address (house, street, area).'),
    line2: optionalText(200),
    city: text(2, 80, 'Please enter the city.'),
    province: optionalText(80),
    postalCode: z
      .string()
      .trim()
      .regex(/^(\d{5})?$/, 'Postal code must be 5 digits.')
      .transform((v) => (v === '' ? null : v))
      .nullish()
      .transform((v) => v ?? null),
  }),
  notes: optionalText(500),
  paymentMethod: z.enum(paymentMethods),
  lines: cartLinesSchema,
  discountCode: discountCodeSchema.optional(),
  /** The total the shopper confirmed. If the server total differs, nothing is placed. */
  expectedTotalMinor: z.int().min(0),
});

/** Client-generated per checkout attempt; retries reuse it. */
export const idempotencyKeySchema = z
  .string({ error: 'Idempotency-Key header is required.' })
  .regex(/^[A-Za-z0-9_-]{16,64}$/, 'Idempotency-Key must be 16–64 URL-safe characters.');

export const orderNumberParamSchema = z.string().min(1).max(32);

export const trackOrderSchema = z.strictObject({
  number: z.string().min(1).max(32),
  phone: pkMobileSchema,
});

export const accountOrdersQuerySchema = z.looseObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const paymentProofFieldsSchema = z.strictObject({
  /** Transaction id / reference from the bank or wallet app. */
  reference: optionalText(100),
  amountMinor: z.coerce.number().int().positive().max(100_000_000).optional(),
});

export type QuoteBody = z.infer<typeof quoteSchema>;
export type PlaceOrderBody = z.infer<typeof placeOrderSchema>;
export type PaymentProofFields = z.infer<typeof paymentProofFieldsSchema>;
