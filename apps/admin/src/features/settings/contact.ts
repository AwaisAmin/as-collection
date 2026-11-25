import type { StoreSettingValues } from '@as/contracts';

/*
 * The contact setting stores each number three ways (shown, international, links). Staff type a
 * number once; the rest is derived here so the shop's call and WhatsApp buttons always match.
 */

/** `0328-9485741`, `+92 328 9485741`, `923289485741` → `+923289485741`; null if not a PK mobile. */
export function pkMobileToE164(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  const match = /^(?:\+?92|0)?(3\d{9})$/.exec(digits);
  return match ? `+92${match[1] ?? ''}` : null;
}

/** `+923289485741` → `0328-9485741` (how Pakistani shoppers write it). */
export function e164ToLocal(e164: string): string {
  const match = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  return match ? `03${(match[1] ?? '').slice(1)}-${match[2] ?? ''}` : e164;
}

/** The WhatsApp number of a stored `https://wa.me/923…` link, as a local number. */
export function whatsappNumber(href: string): string {
  const match = /^https:\/\/wa\.me\/(\d+)/.exec(href);
  return match ? e164ToLocal(`+${match[1] ?? ''}`) : '';
}

export interface ContactInput {
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
}

/** The stored contact value, or the field that can't be read. */
export function contactValue(
  input: ContactInput,
): { value: StoreSettingValues['store.contact'] } | { field: keyof ContactInput; message: string } {
  const phone = pkMobileToE164(input.phone);
  if (!phone)
    return { field: 'phone', message: 'Enter a Pakistani mobile number, e.g. 0328-9485741.' };
  const whatsapp = input.whatsapp.trim() ? pkMobileToE164(input.whatsapp) : phone;
  if (!whatsapp) return { field: 'whatsapp', message: 'Enter a Pakistani mobile number.' };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field: 'email', message: 'Enter an email address.' };
  }
  return {
    value: {
      phone: e164ToLocal(phone),
      phoneE164: phone,
      phoneHref: `tel:${phone}`,
      whatsappHref: `https://wa.me/${whatsapp.slice(1)}`,
      hours: input.hours.trim(),
      email,
      emailHref: `mailto:${email}`,
    },
  };
}
