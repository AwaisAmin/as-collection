/*
 * Images inside section settings follow the shop's rule: a site path (`/media/…`, `/images/…`) or
 * an https URL. Library URLs are https in production (the CDN) but http on a developer's machine,
 * where the shop serves the same files under `/media/`.
 */

/** A library URL as section settings store it. */
export function toContentSrc(url: string): string {
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? url : `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** A stored src as the admin can show it (site paths live on the shop). */
export function previewSrc(src: string, storefrontUrl: string): string {
  if (!src) return '';
  return src.startsWith('/') ? new URL(src, storefrontUrl).href : src;
}

/** `post-7` style ids, unique among `taken`. */
export function nextId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}-${String(n)}`)) n += 1;
  return `${prefix}-${String(n)}`;
}

/** A click on an image → hotspot position in percent (0–100, one decimal). */
export function percentPosition(
  click: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  return {
    x: clamp(((click.x - box.left) / box.width) * 100),
    y: clamp(((click.y - box.top) / box.height) * 100),
  };
}
