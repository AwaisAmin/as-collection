const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 0,
});

/** 3490 → "Rs 3,490" */
export function formatPrice(amount: number): string {
  return pkr.format(amount).replace(/ /g, ' ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Pakistan Standard Time (UTC+5, no DST). */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * ISO date → "12 Nov 2026" in Pakistan time.
 * Hand-rolled (not Intl) so server and browser always render identical text — no hydration
 * mismatches from differing ICU/locale data.
 */
export function formatDate(iso: string): string {
  const d = new Date(Date.parse(iso) + PKT_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 1 → "1 review", 3 → "3 reviews" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
