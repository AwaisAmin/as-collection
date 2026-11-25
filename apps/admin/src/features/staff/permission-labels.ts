import { ALL } from '@/lib/permissions';

/* Short descriptions of a role's access, for role pickers and lists. */

const AREA: Record<string, string> = {
  dashboard: 'Dashboard',
  catalog: 'Catalog',
  inventory: 'Stock',
  media: 'Images',
  orders: 'Orders',
  payments: 'Payments',
  discounts: 'Discounts',
  customers: 'Customers',
  reviews: 'Reviews',
  inbox: 'Inbox',
  newsletter: 'Newsletter',
  content: 'Pages & menus',
  settings: 'Settings',
  staff: 'Staff',
  roles: 'Roles',
  audit: 'Activity log',
};

/** `['*']` → "Full access"; otherwise the areas it reaches and how many permissions. */
export function roleSummary(permissions: readonly string[]): string {
  if (permissions.includes(ALL)) return 'Full access to everything';
  if (!permissions.length) return 'No permissions yet';
  const areas = [...new Set(permissions.map((p) => AREA[p.split('.')[0] ?? ''] ?? p))];
  const count = `${String(permissions.length)} ${permissions.length === 1 ? 'permission' : 'permissions'}`;
  return `${areas.join(', ')} · ${count}`;
}

/** `Order Manager` → `order-manager` (the role key the API wants). */
export const roleKeyFrom = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
