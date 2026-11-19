'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AddToCartResult, CartItem, NewCartItem } from '../types';

/** Per-line ceiling regardless of stock (prevents accidental bulk orders). */
export const MAX_PER_LINE = 10;

interface CartState {
  items: CartItem[];
  addItem: (item: NewCartItem, quantity?: number) => AddToCartResult;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
}

const limitFor = (item: Pick<CartItem, 'maxQuantity'>) => Math.min(item.maxQuantity, MAX_PER_LINE);

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
        const current = existing?.quantity ?? 0;
        const limit = limitFor(item);
        const next = Math.min(current + Math.max(1, quantity), limit);
        const added = next - current;

        if (added > 0) {
          set({
            items: existing
              ? get().items.map((i) =>
                  i.variantId === item.variantId ? { ...i, ...item, quantity: next } : i,
                )
              : [...get().items, { ...item, quantity: next }],
          });
        }
        return { added, capped: current + quantity > limit };
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
                    ? { ...i, quantity: Math.min(quantity, limitFor(i)) }
                    : i,
                ),
        }),

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
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (state: Pick<CartState, 'items'>): number =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
