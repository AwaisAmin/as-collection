'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';

import { useHydrated } from '@/hooks/use-hydrated';

import { type CartTotals, computeCartTotals } from '../lib/cart-totals';
import { useCartStore } from '../store/cart-store';
import type { CartItem } from '../types';

const EMPTY: CartItem[] = [];

/** Hydration-safe cart contents + derived totals. `hydrated` is false during SSR/first paint. */
export function useCart(): { items: CartItem[]; totals: CartTotals; hydrated: boolean } {
  const hydrated = useHydrated();
  const stored = useCartStore((s) => s.items);
  const items = hydrated ? stored : EMPTY;
  const totals = useMemo(() => computeCartTotals(items), [items]);
  return { items, totals, hydrated };
}

/** Line actions shared by the drawer and the cart page (remove has an Undo toast). */
export function useCartLineActions() {
  const removeItem = useCartStore((s) => s.removeItem);
  const restoreItem = useCartStore((s) => s.restoreItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  function remove(item: CartItem) {
    const index = useCartStore.getState().items.findIndex((i) => i.variantId === item.variantId);
    removeItem(item.variantId);
    toast('Removed from cart', {
      description: item.name,
      duration: 8000,
      action: { label: 'Undo', onClick: () => restoreItem(item, index) },
    });
  }

  return { remove, updateQuantity };
}
