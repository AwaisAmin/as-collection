import { describe, expect, it } from 'vitest';

import { contactValue, e164ToLocal, pkMobileToE164, whatsappNumber } from './contact';

describe('store contact', () => {
  it('reads Pakistani mobile numbers however they are typed', () => {
    expect(pkMobileToE164('0328-9485741')).toBe('+923289485741');
    expect(pkMobileToE164('+92 328 9485741')).toBe('+923289485741');
    expect(pkMobileToE164('923289485741')).toBe('+923289485741');
    expect(pkMobileToE164('042-1234567')).toBeNull();
    expect(e164ToLocal('+923289485741')).toBe('0328-9485741');
    expect(whatsappNumber('https://wa.me/923001234567')).toBe('0300-1234567');
  });

  it('derives every link from what staff type', () => {
    const result = contactValue({
      phone: '0328 9485741',
      whatsapp: '',
      email: ' Hello@Shop.PK ',
      hours: 'Mon–Sat 10–8',
    });
    expect(result).toEqual({
      value: {
        phone: '0328-9485741',
        phoneE164: '+923289485741',
        phoneHref: 'tel:+923289485741',
        whatsappHref: 'https://wa.me/923289485741',
        hours: 'Mon–Sat 10–8',
        email: 'hello@shop.pk',
        emailHref: 'mailto:hello@shop.pk',
      },
    });
    expect(
      contactValue({ phone: '0328-9485741', whatsapp: '0300-1234567', email: 'a@b.pk', hours: '' }),
    ).toMatchObject({ value: { whatsappHref: 'https://wa.me/923001234567' } });
    expect(contactValue({ phone: '12', whatsapp: '', email: 'a@b.pk', hours: '' })).toMatchObject({
      field: 'phone',
    });
  });
});
