import type { IncomingMessage } from 'node:http';

/**
 * The full request path without the query string. Uses `originalUrl` because Nest strips the
 * global prefix from `req.url` before middleware runs (`/api/nope` → `/nope`).
 */
export function requestPath(req: IncomingMessage & { originalUrl?: string }): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
}
