'use client';

import { ShoppingCart } from 'lucide-react';
import type { MouseEvent } from 'react';

import { IconLink } from '@/components/ui/icon-button';
import { useCartCount } from '@/features/cart/hooks/use-cart-count';
import { useCartUi } from '@/features/cart/store/cart-store';

export function CartLink({ className }: { className?: string }) {
  const count = useCartCount();
  const openDrawer = useCartUi((s) => s.open);
  const display = count > 99 ? '99+' : String(count);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Plain click opens the mini cart; ctrl/cmd/middle-click (or no JS) still go to /cart.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    openDrawer();
  }

  return (
    <IconLink
      href="/cart"
      onClick={handleClick}
      aria-haspopup="dialog"
      aria-label={`Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={className}
    >
      <ShoppingCart aria-hidden size={32} strokeWidth={1.6} />
      <span
        aria-hidden
        className="absolute -top-1.5 -right-1.5 flex h-4.75 min-w-4.75 items-center justify-center rounded-full bg-ink px-1 font-body text-[12px] leading-none font-bold text-white"
      >
        {display}
      </span>
    </IconLink>
  );
}
