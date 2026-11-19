'use client';

import { useEffect } from 'react';

import { ErrorView } from '@/components/shared/status-views';
import { reportError } from '@/lib/errors/report-error';

/** Errors inside store pages keep the header/footer (this renders inside the (site) layout). */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportError(error, { boundary: '(site)/error' });
  }, [error]);

  return <ErrorView onRetry={retry} />;
}
