'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

interface CarouselProps {
  /** Accessible name of the region — must differ from the surrounding section's heading. */
  label: string;
  children: ReactNode;
  /** Width of each slide. Default: 2.15 cards on phones, 3 on tablets, 4 on desktop. */
  slideClassName?: string;
  className?: string;
}

const defaultSlide =
  'w-[calc((100%-12px)/2.15)] sm:w-[calc((100%-40px)/3)] lg:w-[calc((100%-60px)/4)]';

const arrowClasses = cn(
  'absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full sm:flex',
  'border border-gold bg-ivory text-ink shadow-soft transition-all duration-200',
  'hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-0',
);

/**
 * Horizontal slider on native CSS scroll-snap: touch swipe, trackpads and keyboard scrolling
 * work without JS; the prev/next arrows (tablet and up) page by one viewport.
 * WAI-ARIA carousel pattern: a labelled region whose slides are announced as "n of m".
 */
export function Carousel({ label, children, slideClassName, className }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const slides = Children.toArray(children);

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setEdges({ atStart: scrollLeft <= 4, atEnd: scrollLeft + clientWidth >= scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateEdges();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateEdges);
    };
    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener('scroll', onScroll);
    };
  }, [updateEdges]);

  function page(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({
      left: direction * track.clientWidth * 0.9,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('relative', className)}
    >
      <button
        type="button"
        aria-label="Previous slides"
        disabled={edges.atStart}
        onClick={() => page(-1)}
        className={cn(arrowClasses, '-left-3 lg:-left-5')}
      >
        <ChevronLeft aria-hidden size={22} />
      </button>

      {/* Vertical padding keeps the cards' hover lift and shadow from being clipped. */}
      <div
        ref={trackRef}
        className="-my-3 scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-3 sm:gap-5"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className={cn('shrink-0 snap-start', slideClassName ?? defaultSlide)}
          >
            {slide}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Next slides"
        disabled={edges.atEnd}
        onClick={() => page(1)}
        className={cn(arrowClasses, '-right-3 lg:-right-5')}
      >
        <ChevronRight aria-hidden size={22} />
      </button>
    </div>
  );
}
