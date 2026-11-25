'use client';

import { ArrowLeft, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

import { useCart } from '../hooks/use-cart';
import { useCartServerSync } from '../hooks/use-cart-server-sync';
import { useCartStore } from '../store/cart-store';
import { CartChangesNotice } from './cart-changes-notice';
import { CartLineItem } from './cart-line-item';
import { FreeShippingProgress } from './free-shipping-progress';
import { OrderSummary } from './order-summary';

interface CartViewProps {
  /** Server-rendered product suggestions for the empty state. */
  suggestions?: ReactNode;
}

/** Full cart page body. Re-validates prices/stock against the server once on load. */
export function CartView({ suggestions }: CartViewProps) {
  const { items, totals, hydrated } = useCart();
  const clear = useCartStore((s) => s.clear);
  const { changes, syncing: isSyncing } = useCartServerSync(hydrated);

  if (!hydrated) {
    return (
      <div aria-busy className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Explore our latest collections."
          action={
            <ButtonLink href="/shop" withArrow>
              Start shopping
            </ButtonLink>
          }
        />
        {suggestions}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px] lg:items-start xl:gap-12">
      <div className="flex flex-col gap-5">
        <CartChangesNotice changes={changes} />

        <FreeShippingProgress totals={totals} />

        <div className="rounded-card border border-gold/60 bg-ivory px-5 sm:px-6">
          <ul aria-label="Cart items" aria-busy={isSyncing}>
            {items.map((item) => (
              <CartLineItem key={item.variantId} item={item} />
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 font-body text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden size={16} />
            Continue shopping
          </Link>
          <button
            type="button"
            onClick={clear}
            className="font-body text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Clear cart
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <OrderSummary
          totals={totals}
          action={
            totals.unavailableCount > 0 ? (
              <>
                <Button disabled className="w-full">
                  Proceed to checkout
                </Button>
                <p className="mt-2 text-center text-[14px] font-semibold text-gold-dark">
                  Remove sold-out items to continue.
                </p>
              </>
            ) : (
              <ButtonLink href="/checkout" withArrow className="w-full">
                Proceed to checkout
              </ButtonLink>
            )
          }
        />
      </div>
    </div>
  );
}
