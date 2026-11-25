'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { getCartSnapshots } from '../actions';
import { useCartStore } from '../store/cart-store';
import type { CartChange } from '../types';

/**
 * Re-checks the saved cart's prices and stock against the server once, after the cart has
 * loaded from storage. Used by the cart page and checkout, so a shopper who goes straight to
 * checkout never sees stale prices or a "sold out" flag for an item that is back in stock.
 */
export function useCartServerSync(hydrated: boolean): { changes: CartChange[]; syncing: boolean } {
  const syncWithServer = useCartStore((s) => s.syncWithServer);
  const [changes, setChanges] = useState<CartChange[]>([]);
  const [syncing, startSync] = useTransition();
  const synced = useRef(false);

  useEffect(() => {
    if (!hydrated || synced.current) return;
    synced.current = true;
    const ids = useCartStore.getState().items.map((i) => i.variantId);
    if (ids.length === 0) return;
    startSync(async () => {
      const snapshots = await getCartSnapshots(ids);
      if (snapshots) setChanges(syncWithServer(snapshots));
    });
  }, [hydrated, syncWithServer]);

  return { changes, syncing };
}
