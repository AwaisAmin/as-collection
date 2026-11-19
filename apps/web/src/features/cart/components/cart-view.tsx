'use client';

import { ArrowLeft, Info, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils/format';

import { getCartSnapshots } from '../actions';
import { useCart } from '../hooks/use-cart';
import { useCartStore } from '../store/cart-store';
import type { CartChange } from '../types';
import { CartLineItem } from './cart-line-item';
import { FreeShippingProgress } from './free-shipping-progress';
import { OrderSummary } from './order-summary';

function describe(change: CartChange): string {
  switch (change.kind) {
    case 'price':
      return `${change.name}: price ${change.to < change.from ? 'dropped' : 'changed'} from ${formatPrice(change.from)} to ${formatPrice(change.to)}.`;
    case 'quantity':
      return `${change.name}: only ${change.to} left in stock — quantity updated.`;
    case 'unavailable':
      return `${change.name} is now sold out.`;
  }
}

interface CartViewProps {
  /** Server-rendered product suggestions for the empty state. */
  suggestions?: ReactNode;
}

/** Full cart page body. Re-validates prices/stock against the server once on load. */
export function CartView({ suggestions }: CartViewProps) {
  const { items, totals, hydrated } = useCart();
  const syncWithServer = useCartStore((s) => s.syncWithServer);
  const clear = useCartStore((s) => s.clear);
  const [changes, setChanges] = useState<CartChange[]>([]);
  const [isSyncing, startSync] = useTransition();
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
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start xl:gap-12">
      <div className="flex flex-col gap-5">
        {changes.length > 0 ? (
          <div role="status" className="flex gap-3 rounded-xl border border-gold bg-sand px-4 py-3">
            <Info aria-hidden size={20} className="mt-0.5 shrink-0 text-gold-dark" />
            <div className="text-[16px] text-text">
              <p className="font-bold">We updated your cart with the latest prices and stock:</p>
              <ul className="mt-1 list-disc pl-5">
                {changes.map((c, i) => (
                  <li key={i}>{describe(c)}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

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
