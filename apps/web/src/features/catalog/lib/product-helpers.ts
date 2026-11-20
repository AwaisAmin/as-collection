import type { Money, Product, ProductVariant } from '../types';

/* Pricing and variant helpers for product pages and cards. */

export function minPrice(product: Pick<Product, 'variants'>): Money {
  return Math.min(...product.variants.map((v) => v.price));
}

/** Highest compare-at price among the cheapest variants, if it's actually a discount. */
export function compareAtFor(product: Pick<Product, 'variants'>): Money | undefined {
  const min = minPrice(product);
  const compare = product.variants
    .filter((v) => v.price === min)
    .map((v) => v.compareAtPrice ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return compare > min ? compare : undefined;
}

export function discountPercent(price: Money, compareAt?: Money): number | undefined {
  if (!compareAt || compareAt <= price) return undefined;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Variant matching every selected option (e.g. { Size: 'M' }). */
export function findVariant(
  product: Pick<Product, 'variants'>,
  selected: Readonly<Record<string, string>>,
): ProductVariant | undefined {
  return product.variants.find((v) =>
    Object.entries(v.options).every(([name, value]) => selected[name] === value),
  );
}
