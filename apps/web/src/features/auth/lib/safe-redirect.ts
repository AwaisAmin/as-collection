import type { Route } from 'next';

/**
 * Validates a post-login `next` path to prevent open redirects: only same-site absolute
 * paths are allowed ("/account/orders"), never "//evil.com", "https://…" or "/\\evil".
 */
export function safeRedirectPath(next: unknown, fallback: Route = '/account'): Route {
  if (typeof next !== 'string' || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  if (next.startsWith('/login')) return fallback;
  return next as Route;
}
