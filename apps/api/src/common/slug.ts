/** Same rule as the database CHECK constraints on slug columns. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * "Noor-e-Zar Embroidered Lawn (3 Pc)" → "noor-e-zar-embroidered-lawn-3-pc". Accents are folded
 * (é → e); text with no Latin letters or digits (e.g. Urdu only) gives "" — callers fall back.
 */
export function slugify(text: string, maxLength = 120): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '') // combining marks left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
}

/**
 * First free slug: `base`, then `base-2`, `base-3`… given the taken ones that start with `base`.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, maxLength = 160): string {
  const root = base.slice(0, maxLength - 4).replace(/-+$/g, '');
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const candidate = `${root}-${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
}
