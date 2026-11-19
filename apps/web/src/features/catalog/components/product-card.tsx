import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { RatingStars } from '@/components/ui/rating-stars';
import { cn } from '@/lib/utils/cn';

import { productHref } from '../lib/routes';
import type { ProductSummary } from '../types';
import { Price } from './price';
import { ProductBadges } from './product-badges';

interface ProductCardProps {
  product: ProductSummary;
  /** Slot for feature actions (wishlist heart, quick add) — keeps catalog free of upward deps. */
  actions?: ReactNode;
  /** Slot rendered under the price (e.g. quick add button). */
  footer?: ReactNode;
  /** Set for above-the-fold cards. */
  preload?: boolean;
  className?: string;
}

/**
 * Product tile. The title link is "stretched" over the whole card, so the card is
 * clickable while the action buttons stay separate, valid interactive elements.
 */
export function ProductCard({ product, actions, footer, preload, className }: ProductCardProps) {
  const href = productHref(product.slug);

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-card border border-gold/70 bg-ivory shadow-soft',
        'transition-all duration-300 ease-elegant hover:-translate-y-1 hover:shadow-card-hover',
        'has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-gold-dark',
        className,
      )}
    >
      <div className="relative aspect-3/4 overflow-hidden bg-sand">
        <Image
          src={product.image.src}
          alt=""
          fill
          preload={preload}
          sizes="(min-width: 1280px) 280px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw"
          className={cn(
            'object-cover transition-all duration-500 ease-elegant group-hover:scale-105',
            product.hoverImage && 'group-hover:opacity-0',
            !product.inStock && 'opacity-70 grayscale-35',
          )}
        />
        {product.hoverImage ? (
          <Image
            src={product.hoverImage.src}
            alt=""
            fill
            sizes="(min-width: 1280px) 280px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw"
            className="object-cover opacity-0 transition-all duration-500 ease-elegant group-hover:scale-105 group-hover:opacity-100"
          />
        ) : null}
        <ProductBadges product={product} className="absolute top-3 left-3" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 px-3 pt-4 pb-5 text-center">
        <h3 className="font-display text-[16px]/[1.3] text-ink sm:text-[17px]/[1.3]">
          <Link
            href={href}
            data-card-link=""
            className="transition-colors duration-200 group-hover:text-gold-dark after:absolute after:inset-0 after:z-1 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        {product.rating.count > 0 ? (
          <RatingStars value={product.rating.average} count={product.rating.count} size={13} />
        ) : null}
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          from={product.priceVaries}
          className="mt-auto justify-center pt-1"
        />
        {footer ? <div className="relative z-2 mt-2 w-full">{footer}</div> : null}
      </div>

      {actions ? (
        <div className="absolute top-3 right-3 z-2 flex flex-col gap-2">{actions}</div>
      ) : null}
    </article>
  );
}
