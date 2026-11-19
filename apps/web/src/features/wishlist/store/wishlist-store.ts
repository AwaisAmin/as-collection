'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WishlistState {
  /** Product ids, most recently added first. */
  ids: string[];
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
}

/**
 * Browser-persisted wishlist (product ids only — details are re-fetched so prices stay fresh).
 * Synced to the customer account once auth + API exist.
 */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (productId) => {
        const has = get().ids.includes(productId);
        set({ ids: has ? get().ids.filter((id) => id !== productId) : [productId, ...get().ids] });
        return !has;
      },
      remove: (productId) => set({ ids: get().ids.filter((id) => id !== productId) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'as-wishlist',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
