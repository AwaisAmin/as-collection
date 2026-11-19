'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, use, useCallback, useMemo, useTransition } from 'react';

import { cn } from '@/lib/utils/cn';

interface CatalogNavigation {
  /** Navigate to a filtered/sorted URL as a transition (no scroll jump, keeps UI interactive). */
  navigate: (href: Route) => void;
  isPending: boolean;
}

const CatalogNavigationContext = createContext<CatalogNavigation | null>(null);

export function CatalogNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: Route) => startTransition(() => router.push(href, { scroll: false })),
    [router],
  );

  const value = useMemo(() => ({ navigate, isPending }), [navigate, isPending]);
  return <CatalogNavigationContext value={value}>{children}</CatalogNavigationContext>;
}

export function useCatalogNavigation(): CatalogNavigation {
  const ctx = use(CatalogNavigationContext);
  if (!ctx) throw new Error('useCatalogNavigation must be used inside <CatalogNavigationProvider>');
  return ctx;
}

/** Dims its content and marks it busy while a filter/sort navigation is in flight. */
export function PendingRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isPending } = useCatalogNavigation();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        'transition-opacity duration-200',
        isPending && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
    </div>
  );
}
