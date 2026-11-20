import { z } from 'zod';

import { clearableText } from '../../../common/text.js';

const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
const minor = z.number().int().min(1).max(100_000_000);
const instant = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

/** Same alphabet the checkout accepts; stored upper-case (matching is case-insensitive anyway). */
export const discountCodeInput = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,40}$/, '3–40 letters, digits, dash or underscore')
  .transform((v) => v.toUpperCase());

export const discountTypes = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;

const fields = {
  code: discountCodeInput,
  description: clearableText({ max: 300 }),
  type: z.enum(discountTypes),
  /**
   * PERCENTAGE: basis points (1500 = 15 %, max 10000); FIXED_AMOUNT: paisa; FREE_SHIPPING: 0.
   */
  value: z.number().int().min(0).max(100_000_000),
  minSubtotalMinor: nullable(minor),
  /** Cap for percentage discounts. */
  maxDiscountMinor: nullable(minor),
  startsAt: nullable(instant),
  endsAt: nullable(instant),
  usageLimit: nullable(z.number().int().min(1).max(10_000_000)),
  perCustomerLimit: nullable(z.number().int().min(1).max(1_000)),
  isActive: z.boolean(),
};

interface Shape {
  type?: (typeof discountTypes)[number] | undefined;
  value?: number | undefined;
  maxDiscountMinor?: number | null | undefined;
  startsAt?: Date | null | undefined;
  endsAt?: Date | null | undefined;
}

/** Value rules per type (mirrors the `discounts_value_check` constraint) and the window. */
export function checkDiscountShape(
  d: Shape,
  ctx: { addIssue: (issue: { path: string[]; message: string }) => void },
) {
  if (d.type === 'PERCENTAGE' && d.value !== undefined && (d.value < 1 || d.value > 10_000)) {
    ctx.addIssue({
      path: ['value'],
      message: 'A percentage is 1–10000 basis points (1500 = 15 %).',
    });
  }
  if (d.type === 'FIXED_AMOUNT' && d.value !== undefined && d.value < 1) {
    ctx.addIssue({ path: ['value'], message: 'Enter the amount off, in paisa.' });
  }
  if (d.type === 'FREE_SHIPPING' && d.value !== undefined && d.value !== 0) {
    ctx.addIssue({ path: ['value'], message: 'Free-shipping codes have no value (0).' });
  }
  if (d.type && d.type !== 'PERCENTAGE' && d.maxDiscountMinor) {
    ctx.addIssue({ path: ['maxDiscountMinor'], message: 'Only percentage discounts have a cap.' });
  }
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
    ctx.addIssue({ path: ['endsAt'], message: 'must be after the start' });
  }
}

export const createDiscountSchema = z
  .object({
    ...fields,
    value: fields.value.default(0),
    minSubtotalMinor: fields.minSubtotalMinor.default(null),
    maxDiscountMinor: fields.maxDiscountMinor.default(null),
    startsAt: fields.startsAt.default(null),
    endsAt: fields.endsAt.default(null),
    usageLimit: fields.usageLimit.default(null),
    perCustomerLimit: fields.perCustomerLimit.default(null),
    isActive: fields.isActive.default(true),
  })
  .superRefine((d, ctx) => {
    checkDiscountShape(d, {
      addIssue: (i) => {
        ctx.addIssue({ code: 'custom', ...i });
      },
    });
  });
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = z.object(fields).partial().extend({ updatedAt: instant });
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

export const discountStates = ['active', 'scheduled', 'expired', 'used-up', 'inactive'] as const;

export const listDiscountsQuerySchema = z.object({
  /** Code prefix. */
  q: z.string().trim().min(1).max(40).optional(),
  state: z.enum(discountStates).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListDiscountsQuery = z.infer<typeof listDiscountsQuerySchema>;
