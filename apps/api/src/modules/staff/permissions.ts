/**
 * Every permission the admin panel knows, grouped for the role editor. Code is the source of
 * truth (routes declare what they need); roles in the database are sets of these codes, and "*"
 * grants everything. Add new codes here when adding admin features.
 */
export const PERMISSION_GROUPS = [
  {
    group: 'Dashboard',
    permissions: [{ code: 'dashboard.read', label: 'View dashboard and reports' }],
  },
  {
    group: 'Catalog',
    permissions: [
      { code: 'catalog.read', label: 'View products, categories, collections' },
      { code: 'catalog.write', label: 'Create and edit products, categories, collections' },
      { code: 'inventory.write', label: 'Adjust stock levels' },
      { code: 'media.write', label: 'Upload and manage images' },
    ],
  },
  {
    group: 'Orders',
    permissions: [
      { code: 'orders.read', label: 'View orders and customer details on them' },
      { code: 'orders.write', label: 'Confirm, ship, deliver and cancel orders' },
      { code: 'orders.refund', label: 'Record refunds and returns' },
      { code: 'payments.review', label: 'Approve or reject payment screenshots' },
      { code: 'discounts.write', label: 'Create and edit discount codes' },
    ],
  },
  {
    group: 'Customers',
    permissions: [
      { code: 'customers.read', label: 'View customers' },
      { code: 'customers.write', label: 'Edit or block customers' },
      { code: 'reviews.moderate', label: 'Approve or reject reviews' },
      { code: 'inbox.read', label: 'Read and handle contact messages' },
      { code: 'newsletter.read', label: 'View and export newsletter subscribers' },
    ],
  },
  {
    group: 'Storefront',
    permissions: [
      { code: 'content.write', label: 'Edit pages, sections and menus' },
      { code: 'settings.write', label: 'Edit store settings (shipping, payments, contact)' },
    ],
  },
  {
    group: 'Administration',
    permissions: [
      { code: 'staff.manage', label: 'Add staff, assign roles, reset passwords and 2FA' },
      { code: 'roles.manage', label: 'Create and edit roles' },
      { code: 'audit.read', label: 'View the audit log' },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['code'];

export const ALL = '*';

export const PERMISSION_CODES: ReadonlySet<string> = new Set(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.code)),
);

export const isKnownPermission = (code: string) => code === ALL || PERMISSION_CODES.has(code);

export function hasPermission(granted: ReadonlySet<string>, required: Permission): boolean {
  return granted.has(ALL) || granted.has(required);
}

/**
 * Anti-escalation: may an actor holding `actor` hand out (or touch something holding) `target`?
 * Only if every target permission is one the actor has.
 */
export function covers(actor: ReadonlySet<string>, target: Iterable<string>): boolean {
  if (actor.has(ALL)) return true;
  for (const code of target) if (code === ALL || !actor.has(code)) return false;
  return true;
}
