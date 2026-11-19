'use client';

import { ArrowRight, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type CSSProperties, useId, useState } from 'react';

import { RatingStars } from '@/components/ui/rating-stars';
import { Price } from '@/features/catalog/components/price';
import { productHref } from '@/features/catalog/lib/routes';
import type { ProductSummary } from '@/features/catalog/types';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';

export interface LookItem {
  product: ProductSummary;
  x: number;
  y: number;
}

interface LookExplorerProps {
  title: string;
  description: string;
  image: { src: string; alt: string };
  items: readonly LookItem[];
}

/**
 * Hotspots on the photo and the product list share one "active" index: pressing a dot opens a
 * mini card beside it and highlights the matching row (hovering a row highlights its dot).
 */
export function LookExplorer({ title, description, image, items }: LookExplorerProps) {
  const [active, setActive] = useState<number | null>(null);
  const base = useId();
  useEscapeKey(() => setActive(null), active !== null);

  const total = items.reduce((sum, { product }) => sum + product.price, 0);
  const activeItem = active === null ? null : items[active];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
      <div className="relative mx-auto aspect-3/4 w-full max-w-130 overflow-hidden rounded-card border border-gold/70 bg-sand shadow-soft">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 520px, (min-width: 560px) 520px, 92vw"
          className="object-cover"
        />

        {items.map(({ product, x, y }, i) => {
          const selected = active === i;
          return (
            <button
              key={product.id}
              type="button"
              aria-label={`${i + 1}: ${product.name}`}
              aria-pressed={selected}
              aria-controls={selected ? `${base}-card` : undefined}
              onClick={() => setActive(selected ? null : i)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="group absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-1.5 rounded-full bg-gold/50 motion-safe:animate-ping',
                  selected && 'hidden',
                )}
              />
              <span
                aria-hidden
                className={cn(
                  'relative flex size-8 items-center justify-center rounded-full border-2 font-body text-[15px] font-bold shadow-soft transition-colors duration-200',
                  selected
                    ? 'border-gold bg-ink text-white'
                    : 'border-white bg-ivory text-ink group-hover:bg-ink group-hover:text-white',
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}

        {activeItem ? (
          <div
            id={`${base}-card`}
            role="group"
            aria-label={activeItem.product.name}
            // Phones: docked to the bottom of the photo. sm+: floats beside its dot.
            style={
              {
                '--pop-top': `${Math.min(Math.max(activeItem.y, 18), 80)}%`,
                '--pop-left': activeItem.x > 50 ? 'auto' : `${activeItem.x + 7}%`,
                '--pop-right': activeItem.x > 50 ? `${100 - activeItem.x + 7}%` : 'auto',
              } as CSSProperties
            }
            className={cn(
              'absolute inset-x-3 bottom-3 z-20 flex animate-fade-in gap-3 rounded-xl border border-gold/70 bg-ivory p-2.5 shadow-card-hover',
              'sm:top-(--pop-top) sm:right-(--pop-right) sm:bottom-auto sm:left-(--pop-left) sm:w-55 sm:-translate-y-1/2',
            )}
          >
            <div className="relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
              <Image
                src={activeItem.product.image.src}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 pr-5">
              <p className="line-clamp-2 font-display text-[15px]/snug text-ink">
                {activeItem.product.name}
              </p>
              <Price
                price={activeItem.product.price}
                compareAtPrice={activeItem.product.compareAtPrice}
                from={activeItem.product.priceVaries}
                className="[&>span:first-child]:text-[15px]"
              />
              <Link
                href={productHref(activeItem.product.slug)}
                className="mt-auto inline-flex items-center gap-1 text-[14px] font-semibold text-gold-dark underline-offset-4 hover:underline"
              >
                View product
                <ArrowRight aria-hidden size={13} />
              </Link>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActive(null)}
              className="absolute top-1.5 right-1.5 rounded-full p-1 text-muted transition-colors hover:text-ink"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-center lg:text-left">
          <h3 className="font-display text-[28px]/tight text-ink sm:text-[32px]/tight">{title}</h3>
          <p className="text-[18px] text-muted">{description}</p>
        </div>

        <ol className="flex flex-col gap-3">
          {items.map(({ product }, i) => (
            <li
              key={product.id}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className={cn(
                'relative flex items-center gap-4 rounded-card border bg-cream p-3 transition-colors duration-200',
                active === i ? 'border-gold shadow-soft' : 'border-gold/40',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border font-body text-[15px] font-bold transition-colors',
                  active === i ? 'border-gold bg-ink text-white' : 'border-gold/70 text-ink',
                )}
              >
                {i + 1}
              </span>
              <div className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
                <Image src={product.image.src} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={productHref(product.slug)}
                  className="font-display text-[17px]/snug text-ink after:absolute after:inset-0 after:rounded-card hover:text-gold-dark"
                >
                  {product.name}
                </Link>
                {product.rating.count > 0 ? (
                  <RatingStars
                    value={product.rating.average}
                    count={product.rating.count}
                    size={14}
                  />
                ) : null}
                <Price
                  price={product.price}
                  compareAtPrice={product.compareAtPrice}
                  from={product.priceVaries}
                />
              </div>
              <ArrowRight aria-hidden size={18} className="shrink-0 text-gold-dark" />
            </li>
          ))}
        </ol>

        <p className="text-center text-[17px] text-muted lg:text-left">
          Complete look from <span className="font-semibold text-ink">{formatPrice(total)}</span>
        </p>
      </div>
    </div>
  );
}
