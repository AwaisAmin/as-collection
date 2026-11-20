import type { InventoryReason } from '@as/contracts';

export const REASONS: Record<InventoryReason, { label: string; hint: string }> = {
  RESTOCK: { label: 'New stock arrived', hint: 'A delivery from a supplier or workshop.' },
  ADJUSTMENT: {
    label: 'Stock count correction',
    hint: 'The shelf count differs from the system.',
  },
  DAMAGE: { label: 'Damaged or lost', hint: 'Taken out of sellable stock.' },
  RETURN: { label: 'Returned to stock', hint: 'Sellable items back from a customer.' },
  SALE: { label: 'Sold', hint: 'Recorded automatically when an order ships.' },
};

/** Reasons staff can choose (sales come only from shipping orders). */
export const MANUAL_REASONS = ['RESTOCK', 'ADJUSTMENT', 'DAMAGE', 'RETURN'] as const;
