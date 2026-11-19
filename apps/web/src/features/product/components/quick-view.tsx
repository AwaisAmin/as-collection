'use client';

import { Eye } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { RatingStars } from '@/components/ui/rating-stars';
import { Skeleton } from '@/components/ui/skeleton';
import { productHref } from '@/features/catalog/lib/routes';
import type { Product } from '@/features/catalog/types';
import { useDisclosure } from '@/hooks/use-disclosure';

import { getQuickViewProduct } from '../actions/get-quick-view-product';
import { ProductGallery } from './product-gallery';
import { PurchasePanel } from './purchase-panel';

interface QuickViewButtonProps {
  slug: string;
  productName: string;
}

/** Eye button on product cards → dialog with gallery + purchase panel, loaded on demand. */
export function QuickViewButton({ slug, productName }: QuickViewButtonProps) {
  const { isOpen, open, close } = useDisclosure();
  const [product, setProduct] = useState<Product | null>(null);
  const [failed, setFailed] = useState(false);
  const [isLoading, startTransition] = useTransition();

  function handleOpen() {
    open();
    if (product) return;
    setFailed(false);
    startTransition(async () => {
      const result = await getQuickViewProduct(slug);
      if (result) setProduct(result);
      else setFailed(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-label={`Quick view ${productName}`}
        className="inline-flex size-9 items-center justify-center rounded-full border border-gold/60 bg-ivory/90 text-ink shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-gold lg:translate-y-1 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:focus-visible:translate-y-0 lg:focus-visible:opacity-100"
      >
        <Eye aria-hidden size={18} strokeWidth={1.6} />
      </button>

      <Dialog
        open={isOpen}
        onClose={close}
        title={`Quick view: ${productName}`}
        hideTitle
        size="xl"
      >
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-2 md:gap-8">
          {product ? (
            <>
              <ProductGallery images={product.images} productName={product.name} compact />
              <div className="flex flex-col gap-4">
                <h2 className="pr-10 font-display text-[28px] leading-tight">{product.name}</h2>
                {product.rating.count > 0 ? (
                  <RatingStars value={product.rating.average} count={product.rating.count} />
                ) : null}
                <p className="text-[17px] text-muted">{product.shortDescription}</p>
                <PurchasePanel product={product} onAdded={close} />
                <Link
                  href={productHref(product.slug)}
                  onClick={close}
                  className="self-start font-body text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
                >
                  View full details →
                </Link>
              </div>
            </>
          ) : failed ? (
            <p className="col-span-full py-10 text-center text-[18px] text-muted">
              Sorry, we couldn&apos;t load this product. Please try again.
            </p>
          ) : (
            <div aria-busy={isLoading} className="contents">
              <Skeleton className="aspect-[3/4] w-full rounded-card" />
              <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full rounded-full" />
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
