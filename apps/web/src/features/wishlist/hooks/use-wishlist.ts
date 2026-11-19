'use client';

import { useHydrated } from '@/hooks/use-hydrated';

import { useWishlistStore } from '../store/wishlist-store';

const EMPTY: readonly string[] = [];

/** Hydration-safe wishlist ids (empty during SSR so markup matches). */
export function useWishlistIds(): readonly string[] {
  const hydrated = useHydrated();
  const ids = useWishlistStore((s) => s.ids);
  return hydrated ? ids : EMPTY;
}

export function useIsWishlisted(productId: string): boolean {
  const hydrated = useHydrated();
  const has = useWishlistStore((s) => s.ids.includes(productId));
  return hydrated && has;
}
