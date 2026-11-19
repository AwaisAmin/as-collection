'use client';

import { ShoppingBag } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { formatPrice } from '@/lib/utils/format';

import { useCart } from '../hooks/use-cart';
import { useCartUi } from '../store/cart-store';
import { CartLineItem } from './cart-line-item';
import { FreeShippingProgress } from './free-shipping-progress';

/** Slide-out mini cart (mounted once in the site layout, opened by add-to-cart and the header). */
export function CartDrawer() {
  const { isOpen, close } = useCartUi();
  const { items, totals } = useCart();
  const empty = items.length === 0;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      side="right"
      title={empty ? 'Your cart' : `Your cart (${totals.itemCount})`}
      className="max-w-md"
      footer={
        empty ? null : (
          <div className="flex flex-col gap-3 border-t border-gold/60 bg-ivory p-5">
            <div className="flex items-baseline justify-between font-body">
              <span className="text-[17px] text-muted">Subtotal</span>
              <span className="text-[22px] font-bold text-ink">{formatPrice(totals.subtotal)}</span>
            </div>
            <p className="-mt-1 text-[14px] text-muted">
              {totals.shipping === 0
                ? 'Free delivery included.'
                : `Delivery ${formatPrice(totals.shipping)} — added at checkout.`}
            </p>
            {totals.unavailableCount > 0 ? (
              <>
                <Button disabled className="w-full">
                  Checkout
                </Button>
                <p className="text-center text-[14px] font-semibold text-gold-dark">
                  Remove sold-out items to continue.
                </p>
              </>
            ) : (
              <ButtonLink href="/checkout" onClick={close} withArrow className="w-full">
                Checkout
              </ButtonLink>
            )}
            <ButtonLink
              href="/cart"
              onClick={close}
              variant="ghost"
              className="w-full py-1 text-[16px] underline-offset-4 hover:underline"
            >
              View cart
            </ButtonLink>
          </div>
        )
      }
    >
      <div className="px-5 pt-5">
        {empty ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-gold bg-cream">
              <ShoppingBag aria-hidden className="size-7 text-gold-dark" strokeWidth={1.5} />
            </span>
            <p className="font-display text-[22px]">Your cart is empty</p>
            <p className="text-[17px] text-muted">
              Discover our latest unstitched, stitched and makeup collections.
            </p>
            <ButtonLink href="/shop" onClick={close} withArrow className="mt-2">
              Start shopping
            </ButtonLink>
          </div>
        ) : (
          <>
            <FreeShippingProgress totals={totals} />
            <ul aria-label="Cart items" className="mt-2">
              {items.map((item) => (
                <CartLineItem key={item.variantId} item={item} compact onNavigate={close} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Drawer>
  );
}
