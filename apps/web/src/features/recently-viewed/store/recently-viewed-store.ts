'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** How many products we remember. */
export const RECENTLY_VIEWED_LIMIT = 12;

interface RecentlyViewedState {
  /** Product ids, most recently viewed first. */
  ids: string[];
  record: (productId: string) => void;
  clear: () => void;
}

/** Pure update: move (or add) `id` to the front, keep at most `limit`. */
export function pushRecent(ids: readonly string[], id: string, limit = RECENTLY_VIEWED_LIMIT) {
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, limit);
}

/**
 * Browser-only history of viewed products (ids only — details are re-fetched so prices stay
 * fresh). Never leaves the device.
 */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      ids: [],
      record: (productId) => {
        if (get().ids[0] === productId) return;
        set({ ids: pushRecent(get().ids, productId) });
      },
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'as-recently-viewed',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
