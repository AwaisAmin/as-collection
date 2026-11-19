import { z } from 'zod';

import { pkMobileSchema } from '../../common/phone.js';
import { otpCodeSchema } from '../auth/auth.schemas.js';

/** Trimmed text with inner whitespace collapsed ("  Sana   Khan " → "Sana Khan"). */
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
    .nullish();

export const uuidParamSchema = z.uuid();

export const updateProfileSchema = z
  .strictObject({
    name: text(2, 120, 'Please enter your full name.').optional(),
    /** `null` or `""` removes the email. */
    email: z
      .union([z.literal(''), z.email().max(254)])
      .transform((v) => (v === '' ? null : v.toLowerCase()))
      .nullish(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Nothing to update.',
  });

export const verifyPhoneSchema = z.strictObject({ phone: pkMobileSchema, code: otpCodeSchema });

export const createAddressSchema = z.strictObject({
  label: optionalText(40),
  fullName: text(2, 120, 'Please enter the full name.'),
  phone: pkMobileSchema,
  line1: text(5, 200, 'Please enter the address (house, street, area).'),
  line2: optionalText(200),
  city: text(2, 80, 'Please enter the city.'),
  province: optionalText(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^(\d{5})?$/, 'Postal code must be 5 digits.')
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema
  .partial()
  .extend({
    /** Only `true` is meaningful: make this the default (another address cannot be "un-defaulted"). */
    isDefault: z.literal(true).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Nothing to update.',
  });

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type CreateAddressBody = z.infer<typeof createAddressSchema>;
export type UpdateAddressBody = z.infer<typeof updateAddressSchema>;
