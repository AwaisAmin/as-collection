import type { CartChange, CartItem, VariantSnapshot } from '../types';

export const MAX_PER_LINE = 10;

/** Max units allowed on a line given stock. */
export const lineLimit = (maxQuantity: number) => Math.min(maxQuantity, MAX_PER_LINE);

/**
 * Reconcile cart lines with current server data: update prices, cap quantities to stock,
 * flag discontinued/sold-out lines. Returns the new items and what changed (for a notice).
 */
export function applySnapshots(
  items: readonly CartItem[],
  snapshots: readonly VariantSnapshot[],
): { items: CartItem[]; changes: CartChange[] } {
  const byId = new Map(snapshots.map((s) => [s.variantId, s]));
  const changes: CartChange[] = [];

  const next = items.map((item): CartItem => {
    const snap = byId.get(item.variantId);
    if (!snap || snap.stock <= 0) {
      if (!item.unavailable) changes.push({ kind: 'unavailable', name: item.name });
      return { ...item, unavailable: true, maxQuantity: 0 };
    }

    let updated: CartItem = {
      ...item,
      unavailable: false,
      price: snap.price,
      compareAtPrice: snap.compareAtPrice,
      maxQuantity: snap.stock,
    };
    if (snap.price !== item.price) {
      changes.push({ kind: 'price', name: item.name, from: item.price, to: snap.price });
    }
    const limit = lineLimit(snap.stock);
    if (item.quantity > limit) {
      updated = { ...updated, quantity: limit };
      changes.push({ kind: 'quantity', name: item.name, to: limit });
    }
    return updated;
  });

  return { items: next, changes };
}
