'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

import { useEscapeKey } from '@/hooks/use-escape-key';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { cn } from '@/lib/utils/cn';

import { IconButton } from './icon-button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; also the visible heading unless `header` is given. */
  title: string;
  /** Custom visible header content (e.g. the logo) — `title` still names the dialog. */
  header?: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Accessible slide-in panel (modal dialog): overlay, focus trap, Escape to close,
 * scroll lock, focus moves in on open and returns to the trigger on close.
 * Stays mounted (inert when closed) so the slide transition can run.
 */
export function Drawer({
  open,
  onClose,
  title,
  header,
  footer,
  side = 'left',
  id,
  className,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useLockBodyScroll(open);
  useEscapeKey(onClose, open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-50 bg-ink/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        className={cn(
          'fixed inset-y-0 z-50 flex w-[86%] max-w-sm flex-col border-gold bg-ivory shadow-card-hover transition-transform duration-300 ease-elegant',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gold/60 px-5 py-4">
          {header ? (
            <>
              <span id={titleId} className="sr-only">
                {title}
              </span>
              {header}
            </>
          ) : (
            <h2 id={titleId} className="font-display text-[22px]">
              {title}
            </h2>
          )}
          <IconButton ref={closeRef} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
            <X aria-hidden size={26} strokeWidth={1.6} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </>
  );
}
