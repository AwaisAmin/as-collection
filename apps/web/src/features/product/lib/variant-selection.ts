import type { Product } from '@/features/catalog/types';

export type Selection = Readonly<Record<string, string>>;

export const LOW_STOCK_THRESHOLD = 3;

/** Options the shopper must pick deliberately (no preselect → fewer wrong-size orders). */
const EXPLICIT_OPTIONS = new Set(['Size']);

/** Is `value` purchasable given the shopper's other current choices? */
export function isValueAvailable(
  product: Pick<Product, 'variants'>,
  selected: Selection,
  option: string,
  value: string,
): boolean {
  return product.variants.some(
    (v) =>
      v.stock > 0 &&
      v.options[option] === value &&
      Object.entries(selected).every(([name, val]) => name === option || v.options[name] === val),
  );
}

/** Preselect the first available value for non-explicit options (e.g. shade). */
export function initialSelection(product: Pick<Product, 'options' | 'variants'>): Selection {
  const selection: Record<string, string> = {};
  for (const option of product.options) {
    if (EXPLICIT_OPTIONS.has(option.name)) continue;
    const first = option.values.find((v) =>
      isValueAvailable(product, selection, option.name, v.value),
    );
    if (first) selection[option.name] = first.value;
  }
  return selection;
}

export function missingOptions(product: Pick<Product, 'options'>, selected: Selection): string[] {
  return product.options.filter((o) => !selected[o.name]).map((o) => o.name);
}

export type StockLevel = 'out' | 'low' | 'in';

export function stockStatus(stock: number): { level: StockLevel; label: string } {
  if (stock <= 0) return { level: 'out', label: 'Sold out' };
  if (stock <= LOW_STOCK_THRESHOLD)
    return { level: 'low', label: `Only ${stock} left — order soon` };
  return { level: 'in', label: 'In stock, ready to ship' };
}
