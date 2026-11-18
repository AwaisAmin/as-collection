'use client';

import { useEffect } from 'react';

import { reportError } from '@/lib/errors/report-error';

/** Last-resort boundary for errors thrown in the root layout. Must render <html>/<body>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportError(error, { boundary: 'app/global-error' });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: '#faf1ea',
          color: '#1a1a1a',
          fontFamily: 'Georgia, serif',
        }}
      >
        <h1>Something went wrong</h1>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            borderRadius: 9999,
            border: '1px solid #c9a35e',
            background: '#111010',
            color: '#fff',
            padding: '12px 32px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
