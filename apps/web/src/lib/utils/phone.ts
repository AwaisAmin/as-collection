/**
 * Pakistani mobile numbers: 03XX-XXXXXXX. Accepts common input forms
 * ("0300 1234567", "+92 300 1234567", "923001234567", "3001234567").
 */
const PK_MOBILE = /^3\d{9}$/;

/** Normalized to "03001234567", or null if not a valid PK mobile number. */
export function normalizePkMobile(input: string): string | null {
  let digits = input.replace(/[^\d]/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return PK_MOBILE.test(digits) ? `0${digits}` : null;
}

/** "03001234567" → "0300-1234567" */
export function formatPkMobile(normalized: string): string {
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
