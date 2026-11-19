/**
 * Sliding-window limit over timestamps already stored in Postgres (contact messages, reviews…):
 * durable across restarts and shared by every API instance, unlike an in-memory counter.
 *
 * @param recent timestamps inside the window, newest first (query with `take: max`).
 * @returns seconds until another event is allowed, or `null` when it is allowed now.
 */
export function windowRetryAfterSeconds(
  recent: readonly Date[],
  max: number,
  windowMs: number,
  now: Date,
): number | null {
  if (recent.length < max) return null;
  // Allowed again once the oldest event counted in the window leaves it.
  const oldest = recent[max - 1];
  if (!oldest) return null;
  const waitMs = windowMs - (now.getTime() - oldest.getTime());
  return waitMs > 0 ? Math.max(1, Math.ceil(waitMs / 1000)) : null;
}
