'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { type KeyboardEvent, type MouseEvent, useCallback, useRef, useState } from 'react';

import type { ProductImage } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

interface ProductGalleryProps {
  images: readonly ProductImage[];
  productName: string;
  /** Compact layout for quick view (no thumbnail column). */
  compact?: boolean;
}

/**
 * Swipeable gallery (native CSS scroll-snap — works with touch, trackpad and keyboard),
 * thumbnail navigation, prev/next arrows and hover zoom on precise pointers.
 */
export function ProductGallery({ images, productName, compact = false }: ProductGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = images.length;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const i = (index + count) % count;
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      setActive(i);
    },
    [count],
  );

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) setActive(i);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(active - 1);
    }
  }

  /** Zoom origin follows the cursor; no re-render (CSS custom properties). */
  function onZoomMove(event: MouseEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--zx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--zy', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  const arrow =
    'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-gold/70 bg-ivory/90 text-ink shadow-soft backdrop-blur-sm transition hover:border-gold hover:bg-ivory lg:flex';

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        !compact && count > 1 && 'lg:grid lg:grid-cols-[84px_1fr] lg:items-start',
      )}
    >
      {/* Main viewer */}
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${productName} images`}
        className={cn(
          'group relative overflow-hidden rounded-card border border-gold/60 bg-sand',
          !compact && count > 1 && 'lg:order-2',
        )}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          tabIndex={0}
          aria-label="Use left and right arrow keys to browse images"
          className="scrollbar-none flex aspect-[3/4] snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-offset-[-4px]"
        >
          {images.map((image, i) => (
            <div
              key={image.src + i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              className="relative h-full w-full shrink-0 snap-center overflow-hidden"
              onMouseMove={onZoomMove}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                preload={i === 0 && !compact}
                sizes={
                  compact ? '(min-width: 640px) 400px, 100vw' : '(min-width: 1024px) 45vw, 100vw'
                }
                className="[transform-origin:var(--zx,50%)_var(--zy,50%)] object-cover transition-transform duration-300 ease-out pointer-fine:hover:scale-[1.8]"
              />
            </div>
          ))}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="Previous image"
              className={cn(arrow, 'left-3')}
            >
              <ChevronLeft aria-hidden size={22} />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Next image"
              className={cn(arrow, 'right-3')}
            >
              <ChevronRight aria-hidden size={22} />
            </button>
            {/* Mobile position dots */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden"
            >
              {images.map((image, i) => (
                <span
                  key={image.src + i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === active ? 'w-5 bg-ink' : 'w-1.5 bg-ink/35',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Thumbnails */}
      {count > 1 ? (
        <ul
          aria-label="Choose image"
          className={cn(
            'scrollbar-none flex gap-3 overflow-x-auto',
            compact ? 'hidden' : 'hidden sm:flex lg:order-1 lg:flex-col lg:overflow-visible',
          )}
        >
          {images.map((image, i) => (
            <li key={image.src + i} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === active ? 'true' : undefined}
                className={cn(
                  'relative block aspect-[3/4] w-[72px] overflow-hidden rounded-lg border-2 transition-all lg:w-[84px]',
                  i === active
                    ? 'border-ink'
                    : 'border-gold/40 opacity-75 hover:border-gold hover:opacity-100',
                )}
              >
                <Image src={image.src} alt="" fill sizes="84px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
