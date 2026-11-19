import { z } from 'zod';

import { normalizePkMobile } from '@/lib/utils/phone';

export const contactTopics = [
  'Order enquiry',
  'Returns & exchange',
  'Product question',
  'Bulk / wholesale',
  'Other',
] as const;

export const contactSchema = z
  .object({
    name: z.string().trim().min(3, 'Please enter your name.').max(80),
    phone: z.string().trim(),
    email: z.string().trim().toLowerCase(),
    topic: z.enum(contactTopics, { error: 'Please choose a topic.' }),
    orderNumber: z.string().trim().toUpperCase().max(20),
    message: z
      .string()
      .trim()
      .min(10, 'Please write a little more (10+ characters).')
      .max(2000, 'Message is too long (2000 characters max).'),
  })
  .superRefine((d, ctx) => {
    const phoneOk = d.phone === '' || normalizePkMobile(d.phone) !== null;
    const emailOk = d.email === '' || z.email().safeParse(d.email).success;
    if (!phoneOk)
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid mobile number.' });
    if (!emailOk)
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address.' });
    if (d.phone === '' && d.email === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Add a phone number or email so we can reply.',
      });
    }
  });

export type ContactField = keyof z.input<typeof contactSchema>;
export const CONTACT_HONEYPOT = 'company_site';
