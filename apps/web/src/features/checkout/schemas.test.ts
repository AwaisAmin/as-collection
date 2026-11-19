import { describe, expect, it } from 'vitest';

import { checkoutFieldsSchema, fieldErrorsFrom, validateScreenshot } from './schemas';

const valid = {
  fullName: 'Ayesha Khan',
  phone: '+92 328 9485741',
  email: 'Ayesha@Example.com',
  city: 'Lahore',
  address: 'House 12, Street 4, DHA Phase 5',
  postalCode: '',
  notes: '',
  paymentMethod: 'cod',
  transactionRef: '',
};

describe('checkoutFieldsSchema', () => {
  it('normalizes phone and email', () => {
    const r = checkoutFieldsSchema.parse(valid);
    expect(r.phone).toBe('03289485741');
    expect(r.email).toBe('ayesha@example.com');
  });

  it('allows an empty email and postal code', () => {
    expect(checkoutFieldsSchema.safeParse({ ...valid, email: '', postalCode: '' }).success).toBe(
      true,
    );
  });

  it('reports one message per invalid field', () => {
    const r = checkoutFieldsSchema.safeParse({
      ...valid,
      fullName: 'A',
      phone: '12345',
      address: 'short',
      postalCode: '123',
    });
    expect(r.success).toBe(false);
    const errors = fieldErrorsFrom(r.error!);
    expect(Object.keys(errors).sort()).toEqual(['address', 'fullName', 'phone', 'postalCode']);
  });

  it('requires a transfer channel for bank transfers', () => {
    const r = checkoutFieldsSchema.safeParse({ ...valid, paymentMethod: 'bank_transfer' });
    expect(r.success).toBe(false);
    expect(fieldErrorsFrom(r.error!).transferChannel).toBe('Choose where you sent the payment.');
    expect(
      checkoutFieldsSchema.safeParse({
        ...valid,
        paymentMethod: 'bank_transfer',
        transferChannel: 'jazzcash',
      }).success,
    ).toBe(true);
  });
});

describe('validateScreenshot', () => {
  const file = (size: number, type: string) => new File([new Uint8Array(size)], 'proof', { type });

  it('requires an image under 5 MB', () => {
    expect(validateScreenshot(null)).toMatch(/upload/);
    expect(validateScreenshot(file(100, 'application/pdf'))).toMatch(/JPG, PNG or WEBP/);
    expect(validateScreenshot(file(6 * 1024 * 1024, 'image/png'))).toMatch(/5 MB/);
    expect(validateScreenshot(file(2000, 'image/jpeg'))).toBeNull();
  });
});
