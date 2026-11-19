'use client';

import { useEffect } from 'react';

import { ErrorView } from '@/components/shared/status-views';
import { reportError } from '@/lib/errors/report-error';

/** Root-level fallback (errors outside the store layout). Store pages use (site)/error.tsx. */
export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportError(error, { boundary: 'app/error' });
  }, [error]);

  return <ErrorView onRetry={retry} />;
}
