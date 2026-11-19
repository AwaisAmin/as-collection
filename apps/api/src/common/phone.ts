import { z } from 'zod';

/**
 * Pakistani mobile numbers in any common spelling → E.164 (`+923001234567`):
 * `0300-1234567`, `0300 1234567`, `3001234567`, `923001234567`, `+92 300 1234567`, `0092…`.
 * Returns `null` for anything that is not a PK mobile (landlines, other countries).
 */
export function normalizePkMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const match = /^(?:\+92|0092|92|0)?(3\d{9})$/.exec(digits);
  return match ? `+92${match[1] ?? ''}` : null;
}

/** `+923001234567` → `+92 300 ***4567` (for logs and "code sent to" messages). */
export function maskPhone(e164: string): string {
  return e164.length < 8 ? '***' : `${e164.slice(0, 3)} ${e164.slice(3, 6)} ***${e164.slice(-4)}`;
}

/** Request field: a Pakistani mobile in any spelling, validated and normalized to E.164. */
export const pkMobileSchema = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const phone = normalizePkMobile(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Pakistani mobile number.' });
      return z.NEVER;
    }
    return phone;
  });
