'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Modal built on the native `<dialog>`: focus is trapped and restored, Escape closes it, the
 * page behind is inert. Clicking the backdrop closes it too.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'border-line bg-surface m-auto w-[calc(100%-2rem)] max-w-md rounded-card border p-0 text-text shadow-xl',
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]',
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={titleId} className="text-[17px] font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="text-[14px] text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-canvas -mt-1 -mr-1 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:text-text"
            >
              <X aria-hidden size={18} />
              <span className="sr-only">Close</span>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
