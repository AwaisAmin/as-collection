'use client';

import { type RefObject, useEffect, useState } from 'react';

type Callback = (entry: IntersectionObserverEntry) => void;

/**
 * One IntersectionObserver per unique option set, shared by every caller —
 * cheaper than an observer per element when many sections reveal on scroll.
 */
const observers = new Map<
  string,
  { observer: IntersectionObserver; callbacks: Map<Element, Callback> }
>();

function observe(element: Element, options: IntersectionObserverInit, callback: Callback) {
  const key = `${options.rootMargin ?? ''}|${String(options.threshold ?? 0)}`;
  let entry = observers.get(key);

  if (!entry) {
    const callbacks = new Map<Element, Callback>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) callbacks.get(e.target)?.(e);
    }, options);
    entry = { observer, callbacks };
    observers.set(key, entry);
  }

  entry.callbacks.set(element, callback);
  entry.observer.observe(element);

  const { observer, callbacks } = entry;
  return () => {
    callbacks.delete(element);
    observer.unobserve(element);
  };
}

interface UseInViewOptions {
  /** Stop observing after the first time the element enters the viewport. */
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
}

/** `true` while (or once) the referenced element is in the viewport. */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { once = true, rootMargin = '0px 0px -10% 0px', threshold = 0.15 }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const stop = observe(element, { rootMargin, threshold }, (entry) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) stop();
      } else if (!once) {
        setInView(false);
      }
    });
    return stop;
  }, [ref, once, rootMargin, threshold]);

  // Very old browsers without IntersectionObserver: treat as always in view.
  const unsupported = typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined';
  return inView || unsupported;
}
