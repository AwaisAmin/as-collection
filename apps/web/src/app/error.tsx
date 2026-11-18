'use client';

import { useEffect } from 'react';

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
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="max-w-md opacity-80">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full border border-[#c9a35e] bg-[#111010] px-8 py-3 text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
