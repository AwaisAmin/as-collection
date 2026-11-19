/**
 * Unique-constraint violation (P2002), optionally only when its metadata mentions `needle`
 * (a column or index name). Duck-typed so it works across the generated client and adapters.
 */
export const isUniqueViolation = (error: unknown, needle?: string): boolean =>
  error instanceof Error &&
  error.name === 'PrismaClientKnownRequestError' &&
  (error as Error & { code?: string }).code === 'P2002' &&
  (needle === undefined ||
    JSON.stringify((error as Error & { meta?: unknown }).meta ?? '').includes(needle));
