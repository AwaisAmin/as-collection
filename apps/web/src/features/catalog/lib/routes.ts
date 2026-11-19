import type { Route } from 'next';

/** Single place that knows product URL structure. */
export function productHref(slug: string): Route {
  return `/products/${slug}` as Route;
}
