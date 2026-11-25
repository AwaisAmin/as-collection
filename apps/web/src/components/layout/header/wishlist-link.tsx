'use client';

import { Heart } from 'lucide-react';

import { IconLink } from '@/components/ui/icon-button';
import { useWishlistIds } from '@/features/wishlist/hooks/use-wishlist';

/** Desktop header link to the saved items (phones reach it from the menu). */
export function WishlistLink({ className }: { className?: string }) {
  const count = useWishlistIds().length;
  return (
    <IconLink
      href="/wishlist"
      aria-label={`Wishlist, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={className}
    >
      <Heart aria-hidden size={29} strokeWidth={1.6} />
      {count ? (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 flex h-4.75 min-w-4.75 items-center justify-center rounded-full bg-ink px-1 font-body text-[12px] leading-none font-bold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </IconLink>
  );
}
