'use client';

import { RotateCcw, SearchX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { useStoreSettings } from '@/features/content/components/store-content-provider';

function Shell({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: typeof SearchX;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center"
    >
      <span className="flex size-20 items-center justify-center rounded-full border-2 border-gold bg-ivory shadow-soft">
        <Icon aria-hidden className="size-9 text-gold-dark" strokeWidth={1.5} />
      </span>
      {eyebrow ? (
        <p className="font-caps text-sm tracking-[0.35em] text-muted uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="font-display text-[36px]/[1.15] sm:text-[42px]/[1.15]">{title}</h1>
      <OrnamentDivider width={120} />
      {children}
    </main>
  );
}

export function NotFoundView() {
  return (
    <Shell icon={SearchX} eyebrow="404" title="Page not found">
      <p className="max-w-md text-[19px] text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop" withArrow>
          Shop the collection
        </ButtonLink>
        <ButtonLink href="/" variant="ghost" className="border-[1.5px] border-gold">
          Back to Home
        </ButtonLink>
      </div>
    </Shell>
  );
}

export function ErrorView({ onRetry }: { onRetry: () => void }) {
  // Outside the storefront layout (global error) this is the bundled default number.
  const { contact } = useStoreSettings();
  return (
    <Shell icon={TriangleAlert} title="Something went wrong">
      <div role="alert" className="flex flex-col items-center gap-5">
        <p className="max-w-md text-[19px] text-muted">
          We couldn&apos;t load this page. Please try again — if it keeps happening, contact us on{' '}
          {contact.phone}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onRetry}>
            <RotateCcw aria-hidden size={17} />
            Try again
          </Button>
          <ButtonLink href="/" variant="ghost" className="border-[1.5px] border-gold">
            Back to Home
          </ButtonLink>
        </div>
      </div>
    </Shell>
  );
}
