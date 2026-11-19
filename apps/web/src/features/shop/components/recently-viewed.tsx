'use client';

import { useEffect, useState, useTransition } from 'react';

import { Carousel } from '@/components/ui/carousel';
import { SectionHeading } from '@/components/ui/section-heading';
import type { ProductSummary } from '@/features/catalog/types';
import { useRecentlyViewedStore } from '@/features/recently-viewed/store/recently-viewed-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/utils/cn';

import { getProductsByIds } from '../actions';
import { ShopProductCard } from './shop-product-card';

interface RecentlyViewedProps {
  /** Hide this product (the one on the current product page). */
  excludeId?: string;
  /** Need at least this many products before the section shows. */
  minItems?: number;
  className?: string;
}

/**
 * "Recently viewed" slider from the browser's history. Renders nothing for first-time
 * visitors, so it never shows an empty shell; product data is fetched fresh from the server.
 */
export function RecentlyViewed({ excludeId, minItems = 1, className }: RecentlyViewedProps) {
  const hydrated = useHydrated();
  const ids = useRecentlyViewedStore((s) => s.ids);
  const clear = useRecentlyViewedStore((s) => s.clear);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [, startTransition] = useTransition();

  const wanted = ids.filter((id) => id !== excludeId);
  const key = wanted.join(',');

  useEffect(() => {
    if (!hydrated || !key) return;
    startTransition(async () => {
      setProducts(await getProductsByIds(key.split(',')));
    });
  }, [hydrated, key]);

  // Keep the store's order and drop anything no longer wanted (e.g. after "Clear").
  const visible = products.filter((p) => wanted.includes(p.id));
  if (!hydrated || visible.length < minItems) return null;

  return (
    <section aria-labelledby="recently-viewed-title" className={cn('animate-fade-in', className)}>
      <div className="flex flex-col items-center gap-3">
        <SectionHeading id="recently-viewed-title" title="Recently Viewed" />
        <button
          type="button"
          onClick={clear}
          className="font-body text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
        >
          Clear history
        </button>
      </div>
      <Carousel label="Products you viewed" className="mt-8">
        {visible.map((product) => (
          <ShopProductCard key={product.id} product={product} />
        ))}
      </Carousel>
    </section>
  );
}
