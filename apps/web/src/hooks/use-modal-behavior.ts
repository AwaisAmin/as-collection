'use client';

import { type RefObject, useEffect, useRef } from 'react';

import { useEscapeKey } from './use-escape-key';
import { useFocusTrap } from './use-focus-trap';
import { useLockBodyScroll } from './use-lock-body-scroll';

/**
 * Everything a modal surface (dialog, drawer) needs for accessibility:
 * scroll lock, Escape to close, focus trap, focus moves to `initialFocusRef` on open
 * and returns to whatever had focus before (the trigger) on close.
 */
export function useModalBehavior<T extends HTMLElement, F extends HTMLElement>({
  open,
  onClose,
  containerRef,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<T | null>;
  initialFocusRef: RefObject<F | null>;
}): void {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLockBodyScroll(open);
  useEscapeKey(onClose, open);
  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      initialFocusRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open, initialFocusRef]);
}
