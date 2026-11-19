import { maskPhone, normalizePkMobile, pkMobileSchema } from './phone.js';

describe('normalizePkMobile', () => {
  it.each([
    '03001234567',
    '0300-1234567',
    '0300 123 4567',
    '3001234567',
    '923001234567',
    '+92 300 1234567',
    '+92 (300) 1234567',
    '00923001234567',
  ])('normalizes %s to E.164', (input) => {
    expect(normalizePkMobile(input)).toBe('+923001234567');
  });

  it.each(['0421234567', '+14155550123', '0300123456', '030012345678', '', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normalizePkMobile(input)).toBeNull();
    },
  );
});

describe('maskPhone', () => {
  it('keeps only the operator code and last four digits', () => {
    expect(maskPhone('+923001234567')).toBe('+92 300 ***4567');
  });
});

describe('pkMobileSchema', () => {
  it('validates and normalizes', () => {
    expect(pkMobileSchema.parse('0300-1234567')).toBe('+923001234567');
    expect(pkMobileSchema.safeParse('12345').success).toBe(false);
  });
});
