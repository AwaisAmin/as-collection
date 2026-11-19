'use client';

import { X } from 'lucide-react';
import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { cn } from '@/lib/utils/cn';

import { IconButton } from './icon-button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hide the visible heading (still announced to screen readers). */
  hideTitle?: boolean;
  description?: string;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  children: ReactNode;
}

const sizes = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' } as const;

/**
 * Centered modal dialog (size guide, quick view). Shares focus/scroll/escape handling
 * with Drawer via `useModalBehavior`. Unmounted while closed.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle = false,
  description,
  size = 'md',
  className,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalBehavior({ open, onClose, containerRef: panelRef, initialFocusRef: closeRef });

  if (!open) return null;

  // Portal to <body>: escapes ancestor stacking contexts/transforms (e.g. a hovered product card).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div aria-hidden onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/55" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-fade-up flex-col overflow-hidden rounded-t-card border border-gold bg-ivory shadow-card-hover sm:rounded-card',
          sizes[size],
          className,
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-4 px-5 pt-4 sm:px-7 sm:pt-6',
            hideTitle ? 'absolute top-0 right-0 z-10' : 'border-b border-gold/50 pb-4',
          )}
        >
          <div className={hideTitle ? 'sr-only' : undefined}>
            <h2 id={titleId} className="font-display text-[24px] leading-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[16px] text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            ref={closeRef}
            aria-label="Close"
            onClick={onClose}
            className={cn(hideTitle && 'bg-ivory/90 shadow-soft')}
          >
            <X aria-hidden size={24} strokeWidth={1.6} />
          </IconButton>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
