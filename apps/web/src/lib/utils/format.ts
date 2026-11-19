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

const dateFormat = new Intl.DateTimeFormat('en-PK', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Karachi',
});

/** ISO date → "12 Nov 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** 1 → "1 review", 3 → "3 reviews" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
