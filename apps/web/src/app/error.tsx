'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/errors/report-error';

export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportError(error, { boundary: 'app/error' });
  }, [error]);

  return (
    <main
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center"
    >
      <h1 className="font-display text-[40px] leading-tight">Something went wrong</h1>
      <p className="max-w-md text-[19px] text-muted">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
