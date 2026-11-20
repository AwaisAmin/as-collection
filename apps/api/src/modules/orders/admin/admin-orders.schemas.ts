import { z } from 'zod';

import { optionalPlainText, plainText } from '../../../common/text.js';

const orderStatuses = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;
const paymentStatuses = ['UNPAID', 'AWAITING_VERIFICATION', 'PAID', 'REFUNDED', 'FAILED'] as const;
const paymentMethods = ['COD', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA'] as const;

/** `a,b` or repeated params → deduplicated list of allowed values. */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).max(values.length))
    .transform((list) => [...new Set(list)]);

export const adminOrdersQuerySchema = z.looseObject({
  status: csvEnum(orderStatuses).optional(),
  paymentStatus: csvEnum(paymentStatuses).optional(),
  paymentMethod: csvEnum(paymentMethods).optional(),
  /** Order number, phone (any spelling) or part of the customer's name. */
  q: z.string().trim().min(2).max(80).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

const note = optionalPlainText({ max: 500, multiline: true });

export const noteOnlySchema = z.strictObject({ note });

export const shipSchema = z.strictObject({
  courier: plainText({ min: 2, max: 60, tooShort: 'Enter the courier (e.g. TCS, Leopards).' }),
  trackingNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,64}$/, 'Tracking numbers use letters, digits and dashes.')
    .optional(),
  note,
});

export const cancelSchema = z.strictObject({
  /** Internal reason (not shown to the customer). */
  reason: plainText({ min: 3, max: 500, multiline: true, tooShort: 'Give a short reason.' }),
});

export const returnSchema = z.strictObject({
  /** Put the returned units back into sellable stock (false for damaged goods). */
  restock: z.boolean(),
  note,
});

export const refundSchema = z.strictObject({
  /** Bank / wallet transaction id of the refund. */
  reference: optionalPlainText({ max: 100 }),
  note,
});

export const addNoteSchema = z.strictObject({
  note: plainText({ min: 1, max: 1000, multiline: true }),
  /** Shown on the customer's order page and tracking timeline. */
  customerVisible: z.boolean().default(false),
});

export const acceptProofSchema = z.strictObject({ note });

export const rejectProofSchema = z.strictObject({
  /** Shown to the customer so they can fix it ("amount does not match", "unreadable"). */
  reason: plainText({ min: 3, max: 300, tooShort: 'Tell the customer what is wrong.' }),
});

export const proofIdParamSchema = z.uuid();
