import { z } from 'zod';

import { pkMobileSchema } from '../../common/phone.js';
import { plainText } from '../../common/text.js';
import { emailSchema } from '../newsletter/newsletter.schemas.js';
import { normalizeOrderNumber } from '../orders/order-number.js';

export const contactTopics = ['ORDER', 'RETURNS', 'PRODUCT', 'WHOLESALE', 'OTHER'] as const;

/** Missing, null or "" → null; anything else must pass `schema`. */
const optional = <T extends z.ZodType<string, string>>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .nullish()
    .transform((v) => (v === '' || v == null ? null : v));

const orderNumberSchema = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const number = normalizeOrderNumber(value);
    if (!number) {
      ctx.addIssue({ code: 'custom', message: 'Enter the order number from your confirmation.' });
      return z.NEVER;
    }
    return number;
  });

export const contactMessageSchema = z
  .strictObject({
    name: plainText({ min: 3, max: 80, tooShort: 'Please enter your name.' }),
    phone: optional(pkMobileSchema),
    email: optional(emailSchema),
    topic: z.enum(contactTopics, { error: 'Please choose a topic.' }),
    orderNumber: optional(orderNumberSchema),
    message: plainText({
      min: 10,
      max: 2000,
      multiline: true,
      tooShort: 'Please write a little more (10+ characters).',
      tooLong: 'Message is too long (2000 characters max).',
    }),
  })
  .refine((d) => d.phone !== null || d.email !== null, {
    path: ['phone'],
    message: 'Add a phone number or email so we can reply.',
  });
export type ContactMessageBody = z.infer<typeof contactMessageSchema>;
