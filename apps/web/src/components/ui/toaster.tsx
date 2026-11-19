'use client';

import { Toaster as SonnerToaster } from 'sonner';

/** App-wide toast outlet, styled to the brand (ivory · gold · ink). */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      duration={4500}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[calc(100vw-32px)] max-w-95 items-start gap-3 rounded-card border border-gold bg-ivory px-5 py-4 text-text shadow-card-hover',
          title: 'font-display text-[17px] leading-snug',
          description: 'font-body text-[16px] text-muted',
          icon: 'mt-0.5 text-gold',
          content: 'min-w-0 flex-1',
          actionButton:
            'shrink-0 self-center rounded-full border border-gold bg-ink px-3.5 py-1.5 font-display text-[13px] whitespace-nowrap text-white transition-opacity hover:opacity-90',
          closeButton:
            'order-last ml-auto rounded-full text-muted transition-colors hover:text-gold [&>svg]:size-4',
        },
      }}
    />
  );
}
