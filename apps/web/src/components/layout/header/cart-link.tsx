'use client';

import { ShoppingCart } from 'lucide-react';

import { IconLink } from '@/components/ui/icon-button';
import { useCartCount } from '@/features/cart/hooks/use-cart-count';

export function CartLink({ className }: { className?: string }) {
  const count = useCartCount();
  const display = count > 99 ? '99+' : String(count);

  return (
    <IconLink
      href="/cart"
      aria-label={`Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={className}
    >
      <ShoppingCart aria-hidden size={32} strokeWidth={1.6} />
      <span
        aria-hidden
        className="absolute -top-1.5 -right-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-ink px-1 font-body text-[12px] leading-none font-bold text-white"
      >
        {display}
      </span>
    </IconLink>
  );
}
