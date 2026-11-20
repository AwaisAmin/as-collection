import { z } from 'zod';

import { normalizePkMobile } from '@/lib/utils/phone';

export const pkMobileSchema = z
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
  });

export const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const personNameSchema = z
  .string()
  .trim()
  .min(3, 'Please enter your full name.')
  .max(80, 'Name is too long.');

export const profileSchema = z.object({
  name: personNameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address.'),
});

export const addressSchema = z.object({
  label: z.string().trim().min(2, 'Add a label, e.g. Home.').max(30, 'Label is too long.'),
  recipientName: personNameSchema,
  phone: pkMobileSchema,
  city: z.string().trim().min(2, 'Please enter the city.').max(60),
  address: z
    .string()
    .trim()
    .min(10, 'Please enter the full address (house, street, area).')
    .max(200, 'Address is too long.'),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{5}$/.test(v), 'Postal code must be 5 digits.'),
  isDefault: z.boolean().optional(),
});

export type AddressFormField = keyof z.input<typeof addressSchema>;
