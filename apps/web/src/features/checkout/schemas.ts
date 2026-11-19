import { z } from 'zod';

import { transferChannels } from '@/config/payments';
import { normalizePkMobile } from '@/lib/utils/phone';

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const optionalText = (max: number, message?: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(''));

/** Checkout text fields — shared by the client (instant feedback) and the Server Action. */
export const checkoutFieldsSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Please enter your full name.').max(80, 'Name is too long.'),
    phone: z
      .string()
      .trim()
      .transform((value, ctx) => {
        const normalized = normalizePkMobile(value);
        if (!normalized) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter a valid Pakistani mobile number, e.g. 0300-1234567.',
          });
          return z.NEVER;
        }
        return normalized;
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address.'),
    city: z.string().trim().min(2, 'Please enter your city.').max(60),
    address: z
      .string()
      .trim()
      .min(10, 'Please enter your full address (house, street, area).')
      .max(250, 'Address is too long.'),
    postalCode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{5}$/.test(v), 'Postal code must be 5 digits.'),
    notes: optionalText(300, 'Notes are too long (300 characters max).'),
    paymentMethod: z.enum(['cod', 'bank_transfer'], { error: 'Please choose a payment method.' }),
    transferChannel: z.enum(transferChannels).optional(),
    transactionRef: optionalText(40, 'Transaction ID is too long.'),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'bank_transfer' && !data.transferChannel) {
      ctx.addIssue({
        code: 'custom',
        path: ['transferChannel'],
        message: 'Choose where you sent the payment.',
      });
    }
  });

export type CheckoutFields = z.output<typeof checkoutFieldsSchema>;
export type CheckoutField = keyof z.input<typeof checkoutFieldsSchema> | 'screenshot';

export const checkoutLinesSchema = z
  .array(
    z.object({
      variantId: z.string().regex(/^[a-z0-9-]{1,64}$/),
      quantity: z.number().int().min(1).max(10),
    }),
  )
  .min(1, 'Your cart is empty.')
  .max(50);

/** Payment proof for manual transfers. Returns an error message or null. */
export function validateScreenshot(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return 'Please upload a screenshot of your payment.';
  if (!(ACCEPTED_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) {
    return 'Screenshot must be a JPG, PNG or WEBP image.';
  }
  if (file.size > MAX_SCREENSHOT_BYTES) return 'Screenshot must be smaller than 5 MB.';
  return null;
}

/** First message per field, in a flat map (for forms). */
export function fieldErrorsFrom(error: z.ZodError): Partial<Record<CheckoutField, string>> {
  const out: Partial<Record<CheckoutField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as CheckoutField | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
