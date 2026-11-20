/*
 * Display formatting for staff screens. The store runs on Pakistan time and in rupees, whatever
 * the server's or the browser's own settings are.
 */

export const STORE_TIME_ZONE = 'Asia/Karachi';

const rupees = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 });

/** `Rs 12,450` from paisa. */
export function formatMoney(minor: number): string {
  const sign = minor < 0 ? '−' : '';
  return `${sign}Rs ${rupees.format(Math.abs(minor) / 100)}`;
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dateOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `20 Nov 2026, 3:45 pm` (Pakistan time). */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** `20 Nov 2026` (Pakistan time). */
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));

/** `+923001234567` → `0300 1234567`, the way staff dial it. Anything else is left as is. */
export function formatPhone(e164: string): string {
  const match = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  return match ? `0${match[1] ?? ''} ${match[2] ?? ''}` : e164;
}

/** `482 KB`, `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ISO time → `2026-11-20T15:45` for a `datetime-local` input, in Pakistan time. */
export function toPktInput(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** A `datetime-local` value read as Pakistan time (UTC+5, no daylight saving) → ISO. */
export function fromPktInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
