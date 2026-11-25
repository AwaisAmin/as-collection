import { describe, expect, it } from 'vitest';

import { contactSchema } from './schema';

const base = {
  name: 'Ayesha Khan',
  phone: '0300-1234567',
  email: '',
  topic: 'Order enquiry',
  orderNumber: '',
  message: 'Where is my parcel? It is late.',
};

const errors = (input: Partial<typeof base>) => {
  const result = contactSchema.safeParse({ ...base, ...input });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe('contact form rules', () => {
  it('accepts a message with a way to reply', () => {
    expect(errors({})).toEqual({});
    expect(errors({ phone: '', email: 'ayesha@example.com' })).toEqual({});
  });

  it('needs a phone or an email', () => {
    expect(errors({ phone: '' })).toEqual({
      phone: 'Add a phone number or email so we can reply.',
    });
  });

  it('explains what an order number looks like', () => {
    expect(errors({ orderNumber: '12345' }).orderNumber).toMatch(/AS-261119-ABCDE/);
    expect(errors({ orderNumber: ' as-261125-abcde ' })).toEqual({});
  });
});
