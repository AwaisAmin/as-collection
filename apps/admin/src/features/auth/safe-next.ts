/**
 * Where to go after sign-in: only a path on this admin (`/orders?x=1`), never another site
 * (`//evil.com`, `https://…`, `/\evil.com`) or the auth pages themselves.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/^\/(login|change-password)(\/|\?|$)/.test(value)) return '/';
  return value;
}
