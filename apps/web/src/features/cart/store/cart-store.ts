'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { applySnapshots, lineLimit } from '../lib/sync-cart';
import type { AddToCartResult, CartChange, CartItem, NewCartItem, VariantSnapshot } from '../types';

export { MAX_PER_LINE } from '../lib/sync-cart';

interface CartState {
  items: CartItem[];
  addItem: (item: NewCartItem, quantity?: number) => AddToCartResult;
  /** Re-insert a removed line exactly as it was (undo). */
  restoreItem: (item: CartItem, index: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  /** Reconcile with server prices/stock; returns what changed. */
  syncWithServer: (snapshots: readonly VariantSnapshot[]) => CartChange[];
  clear: () => void;
}

/**
 * Client cart, persisted to localStorage, keyed by variant.
 * When the API cart lands, swap the persistence layer here — consumers use selectors only.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        const current = existing?.unavailable ? 0 : (existing?.quantity ?? 0);
        const limit = lineLimit(item.maxQuantity);
        const next = Math.min(current + Math.max(1, quantity), limit);
        const added = next - current;

        if (added > 0) {
          set({
            items: existing
              ? get().items.map((i) =>
                  i.variantId === item.variantId
                    ? { ...i, ...item, quantity: next, unavailable: false }
                    : i,
                )
              : [...get().items, { ...item, quantity: next }],
          });
        }
        return { added, capped: current + quantity > limit };
      },

      restoreItem: (item, index) => {
        if (get().items.some((i) => i.variantId === item.variantId)) return;
        const items = [...get().items];
        items.splice(Math.min(index, items.length), 0, item);
        set({ items });
      },

      removeItem: (variantId) =>
        set({ items: get().items.filter((i) => i.variantId !== variantId) }),

      updateQuantity: (variantId, quantity) =>
        set({
          items:
            quantity <= 0
              ? get().items.filter((i) => i.variantId !== variantId)
              : get().items.map((i) =>
                  i.variantId === variantId
                    ? { ...i, quantity: Math.min(quantity, lineLimit(i.maxQuantity)) }
                    : i,
                ),
        }),

      syncWithServer: (snapshots) => {
        const { items, changes } = applySnapshots(get().items, snapshots);
        set({ items });
        return changes;
      },

      clear: () => set({ items: [] }),
    }),
    {
      name: 'as-cart',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // v1 lines weren't variant-aware and can't be mapped safely — start fresh.
      migrate: (persisted, version) =>
        version < 2 ? { items: [] } : (persisted as Pick<CartState, 'items'>),
    },
  ),
);

export const selectCartCount = (state: Pick<CartState, 'items'>): number =>
  state.items.filter((i) => !i.unavailable).reduce((sum, item) => sum + item.quantity, 0);

/** Ephemeral UI state (not persisted): is the cart drawer open? */
interface CartUiState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useCartUi = create<CartUiState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
