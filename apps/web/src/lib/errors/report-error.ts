/**
 * Central error reporting hook.
 * Swap the body for Sentry / Datadog / etc. without touching call sites.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const digest =
    error instanceof Error && 'digest' in error
      ? (error as Error & { digest?: string }).digest
      : undefined;

  console.error('[app:error]', { error, digest, ...context });
}

/** Safely extract a user-displayable message from an unknown thrown value. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}
