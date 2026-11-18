'use client';

import { useHydrated } from '@/hooks/use-hydrated';

import { selectCartCount, useCartStore } from '../store/cart-store';

/** Total item count; returns 0 until hydrated so SSR and client markup match. */
export function useCartCount(): number {
  const hydrated = useHydrated();
  const count = useCartStore(selectCartCount);
  return hydrated ? count : 0;
}
