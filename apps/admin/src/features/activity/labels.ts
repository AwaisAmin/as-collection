import type { AdminAuditEntryDto } from '@as/contracts';
import { z } from 'zod';

/*
 * The activity log in words: what each action means, where the record lives in the admin, and a
 * short "what changed" summary. Unknown actions still read sensibly (`thing.do-it` → "Thing: do it").
 */

export const AREAS: Readonly<Record<string, string>> = {
  order: 'Orders',
  product: 'Products',
  inventory: 'Stock',
  media: 'Images',
  category: 'Categories',
  collection: 'Collections',
  attribute: 'Attributes',
  brand: 'Brands',
  discount: 'Discounts',
  customer: 'Customers',
  review: 'Reviews',
  contact_message: 'Inbox',
  newsletter: 'Newsletter',
  page: 'Pages',
  menu: 'Menus',
  setting: 'Settings',
  staff: 'Staff & sign-ins',
  role: 'Roles',
};

const ACTIONS: Readonly<Record<string, string>> = {
  'order.confirm': 'Confirmed an order',
  'order.process': 'Started packing an order',
  'order.ship': 'Shipped an order',
  'order.deliver': 'Marked an order delivered',
  'order.cancel': 'Cancelled an order',
  'order.return': 'Recorded a return',
  'order.refund': 'Recorded a refund',
  'order.note': 'Added an order note',
  'payment.proof.accept': 'Accepted a payment screenshot',
  'payment.proof.reject': 'Rejected a payment screenshot',
  'payment.proof.view': 'Viewed a payment screenshot',
  'product.create': 'Created a product',
  'product.update': 'Edited a product',
  'product.delete': 'Deleted a product',
  'variant.create': 'Added a variant',
  'variant.update': 'Edited a variant',
  'variant.delete': 'Removed a variant',
  'inventory.adjust': 'Changed stock',
  'inventory.settings': 'Changed stock settings',
  'media.upload': 'Uploaded an image',
  'media.update': 'Edited an image',
  'media.delete': 'Deleted an image',
  'category.create': 'Created a category',
  'category.update': 'Edited a category',
  'category.delete': 'Deleted a category',
  'category.reorder': 'Reordered categories',
  'collection.create': 'Created a collection',
  'collection.update': 'Edited a collection',
  'collection.delete': 'Deleted a collection',
  'collection.products': 'Changed a collection’s products',
  'collection.reorder': 'Reordered a collection',
  'attribute.create': 'Created an attribute',
  'attribute.update': 'Edited an attribute',
  'attribute.delete': 'Deleted an attribute',
  'attribute.value.create': 'Added an attribute value',
  'attribute.value.update': 'Edited an attribute value',
  'attribute.value.delete': 'Removed an attribute value',
  'brand.create': 'Created a brand',
  'brand.update': 'Edited a brand',
  'brand.delete': 'Deleted a brand',
  'discount.create': 'Created a discount code',
  'discount.update': 'Edited a discount code',
  'discount.delete': 'Deleted a discount code',
  'customer.update': 'Edited a customer',
  'customer.block': 'Blocked a customer',
  'customer.unblock': 'Unblocked a customer',
  'review.approve': 'Published a review',
  'review.reject': 'Rejected a review',
  'review.feature': 'Put a review on the home page',
  'review.unfeature': 'Took a review off the home page',
  'review.reply': 'Replied to a review',
  'review.reply.remove': 'Removed a review reply',
  'review.delete': 'Deleted a review',
  'contact.update': 'Handled a message',
  'newsletter.export': 'Downloaded subscribers',
  'page.create': 'Created a page',
  'page.update': 'Edited a page',
  'page.delete': 'Deleted a page',
  'page.section.create': 'Added a page section',
  'page.section.update': 'Edited a page section',
  'page.section.delete': 'Removed a page section',
  'page.section.reorder': 'Reordered page sections',
  'menu.create': 'Created a menu',
  'menu.update': 'Edited a menu',
  'menu.delete': 'Deleted a menu',
  'setting.update': 'Changed a store setting',
  'staff.create': 'Added a staff member',
  'staff.update': 'Edited a staff member',
  'staff.login': 'Signed in',
  'staff.login.failed': 'Failed sign-in',
  'staff.logout': 'Signed out',
  'staff.password.change': 'Changed own password',
  'staff.password.reset': 'Reset a staff password',
  'staff.sessions.revoke': 'Signed a staff member out everywhere',
  'staff.totp.enable': 'Set up an authenticator',
  'staff.totp.reset': 'Reset an authenticator',
  'staff.unlock': 'Unlocked a staff member',
  'role.create': 'Created a role',
  'role.update': 'Edited a role',
  'role.delete': 'Deleted a role',
};

/** Shown as warnings in the list. */
export const ALERT_ACTIONS: ReadonlySet<string> = new Set([
  'staff.login.failed',
  'customer.block',
  'staff.password.reset',
  'staff.totp.reset',
  'newsletter.export',
]);

export function actionLabel(action: string): string {
  const known = ACTIONS[action];
  if (known) return known;
  const [head = action, ...rest] = action.split('.');
  const words = (s: string) => s.replace(/[-_]/g, ' ');
  return rest.length
    ? `${words(head).replace(/^\w/, (c) => c.toUpperCase())}: ${words(rest.join(' '))}`
    : words(head);
}

/** Where the record lives in the admin, when it has its own page. */
export function entityHref(
  entry: Pick<AdminAuditEntryDto, 'entityType' | 'entityId' | 'changes'>,
): string | null {
  const id = entry.entityId;
  const isId = !!id && z.uuid().safeParse(id).success;
  switch (entry.entityType) {
    case 'order': {
      const number = (entry.changes as { number?: unknown } | null)?.number;
      return typeof number === 'string' ? `/orders/${number}` : null;
    }
    case 'product':
    case 'collection':
    case 'discount':
    case 'customer':
    case 'staff':
    case 'role':
    case 'page':
    case 'attribute':
    case 'category': {
      const base = entry.entityType === 'staff' ? 'staff' : `${entry.entityType}s`;
      return isId ? `/${base}/${id ?? ''}` : null;
    }
    case 'contact_message':
      return isId ? `/inbox/${id ?? ''}` : null;
    case 'inventory':
      return isId ? `/stock/${id ?? ''}` : null;
    default:
      return null;
  }
}

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value))
    return `${String(value.length)} ${value.length === 1 ? 'item' : 'items'}`;
  return '…';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Up to `max` lines like "status: PENDING → CONFIRMED" or "reason: Spam". */
export function changeLines(changes: unknown, max = 4): string[] {
  if (!isRecord(changes)) return [];
  const lines: string[] = [];
  const { before, after, ...rest } = changes;
  if (isRecord(before) || isRecord(after)) {
    const b = isRecord(before) ? before : {};
    const a = isRecord(after) ? after : {};
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[key]) === JSON.stringify(a[key]) || !(key in a)) continue;
      lines.push(`${key}: ${show(b[key])} → ${show(a[key])}`);
    }
  }
  for (const [key, value] of Object.entries(rest)) {
    if (isRecord(value) && ('from' in value || 'to' in value)) {
      lines.push(`${key}: ${show(value.from)} → ${show(value.to)}`);
    } else if (!isRecord(value)) {
      lines.push(`${key}: ${show(value)}`);
    }
  }
  return lines.slice(0, max);
}

// ─── URL state ───

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional().catch(undefined));

const searchSchema = z.object({
  area: optional(z.string().regex(/^[a-z_-]{1,60}$/)),
  actor: optional(z.uuid()),
  record: optional(z.string().regex(/^[\w-]{1,64}$/)),
  before: optional(z.uuid()),
});

export type ActivityQuery = z.infer<typeof searchSchema>;

export const parseActivityQuery = (params: Record<string, unknown>): ActivityQuery =>
  searchSchema.parse(params);

export const toApiQuery = (query: ActivityQuery) => ({
  entityType: query.area,
  actorStaffId: query.actor,
  entityId: query.record,
  before: query.before,
  limit: 50,
});

export function activityHref(query: ActivityQuery, change: Partial<ActivityQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...change })) {
    if (value) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `/activity?${search}` : '/activity';
}
