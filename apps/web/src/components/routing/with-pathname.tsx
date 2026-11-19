'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

type Render = (pathname: string | null) => ReactNode;

function PathnameReader({ children }: { children: Render }) {
  return children(usePathname());
}

/**
 * Renders `children(pathname)`. Reading the URL is request-time data under Cache Components,
 * so it's isolated in Suspense: the fallback is the same UI with `null` (e.g. no active link),
 * which keeps shared layouts (header nav) prerenderable on dynamic routes.
 */
export function WithPathname({ children }: { children: Render }) {
  return (
    <Suspense fallback={children(null)}>
      <PathnameReader>{children}</PathnameReader>
    </Suspense>
  );
}
