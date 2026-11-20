import type { Route } from 'next';

import { canAny } from './permissions';

export type NavIcon =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'media'
  | 'categories'
  | 'collections'
  | 'discounts'
  | 'reviews'
  | 'inbox'
  | 'customers'
  | 'newsletter'
  | 'content'
  | 'settings'
  | 'staff'
  | 'audit';

export interface NavItem {
  label: string;
  href: Route;
  icon: NavIcon;
  /** Shown when the staff member holds any of these (empty: everyone). */
  anyOf: readonly string[];
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/**
 * The admin's sections, grouped. Each new admin area adds its entry here; staff only ever see
 * the areas their roles allow (the API enforces the same permissions on every request).
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/', icon: 'dashboard', anyOf: [] }],
  },
  {
    label: 'Sales',
    items: [{ label: 'Orders', href: '/orders', icon: 'orders', anyOf: ['orders.read'] }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: 'products', anyOf: ['catalog.read'] },
      { label: 'Stock', href: '/stock', icon: 'inventory', anyOf: ['catalog.read'] },
      { label: 'Images', href: '/media', icon: 'media', anyOf: ['catalog.read'] },
    ],
  },
];

/** The navigation a staff member may see (groups with nothing left are dropped). */
export function navigationFor(permissions: readonly string[]): NavGroup[] {
  return NAVIGATION.flatMap((group) => {
    const items = group.items.filter((item) => canAny(permissions, item.anyOf));
    return items.length ? [{ ...group, items }] : [];
  });
}

/** Whether `href` is the current section (prefix match, except the dashboard). */
export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
