import type { Route } from 'next';

import type { CatalogQuery } from '../schemas';

export interface CatalogUrlOptions {
  /** Include `category` as a query param (search page). Category pages carry it in the path. */
  includeCategory?: boolean;
}

/** Encode a value but keep commas readable: `size=S,M` instead of `size=S%2CM`. */
const encode = (value: string) => encodeURIComponent(value).replace(/%2C/gi, ',');

/** Serialize only non-default values, in a stable order (good for caching and sharing). */
export function toQueryString(
  query: CatalogQuery,
  { includeCategory = false }: CatalogUrlOptions = {},
): string {
  const entries: [string, string][] = [];
  if (query.q) entries.push(['q', query.q]);
  if (includeCategory && query.category) entries.push(['category', query.category]);
  if (query.sort !== 'featured') entries.push(['sort', query.sort]);
  if (query.min !== undefined) entries.push(['min', String(query.min)]);
  if (query.max !== undefined) entries.push(['max', String(query.max)]);
  if (query.size.length) entries.push(['size', query.size.join(',')]);
  if (query.shade.length) entries.push(['shade', query.shade.join(',')]);
  if (query.inStock) entries.push(['inStock', '1']);
  if (query.page > 1) entries.push(['page', String(query.page)]);
  return entries.map(([k, v]) => `${k}=${encode(v)}`).join('&');
}

/**
 * URL for `basePath` with the current query plus a patch.
 * Any filter change resets to page 1 unless the patch sets `page` explicitly.
 */
export function catalogHref(
  basePath: string,
  query: CatalogQuery,
  patch: Partial<CatalogQuery> = {},
  options?: CatalogUrlOptions,
): Route {
  const next: CatalogQuery = { ...query, page: 1, ...patch };
  const qs = toQueryString(next, options);
  return (qs ? `${basePath}?${qs}` : basePath) as Route;
}

export function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Number of user-applied filters (sort, search and page don't count). */
export function countActiveFilters(query: CatalogQuery): number {
  return (
    (query.min !== undefined || query.max !== undefined ? 1 : 0) +
    query.size.length +
    query.shade.length +
    (query.inStock ? 1 : 0)
  );
}

/** Query with all filters removed (keeps search, category and sort). */
export function clearFilters(query: CatalogQuery): Partial<CatalogQuery> {
  return { ...query, min: undefined, max: undefined, size: [], shade: [], inStock: false, page: 1 };
}
