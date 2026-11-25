import type { ContactStatus, ContactTopic } from '@as/contracts';
import { z } from 'zod';

import type { BadgeTone } from '@/components/ui/badge';

/*
 * The inbox's words and URL state: `?view=new&topic=ORDER&q=0300…&before=…`. Anything invalid is
 * dropped, so a mistyped link still opens the list. Paging is by cursor, newest first.
 */

export const TOPIC_LABEL: Record<ContactTopic, string> = {
  ORDER: 'An order',
  RETURNS: 'Returns & exchanges',
  PRODUCT: 'A product',
  WHOLESALE: 'Wholesale',
  OTHER: 'Something else',
};
export const TOPICS = Object.keys(TOPIC_LABEL) as ContactTopic[];

export const MESSAGE_STATUS: Record<ContactStatus, { label: string; tone: BadgeTone }> = {
  NEW: { label: 'New', tone: 'gold' },
  READ: { label: 'Read', tone: 'neutral' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
};

export const INBOX_VIEWS = [
  { key: 'new', label: 'New', status: 'NEW' },
  { key: 'read', label: 'Read', status: 'READ' },
  { key: 'archived', label: 'Archived', status: 'ARCHIVED' },
  { key: 'all', label: 'All', status: undefined },
] as const satisfies readonly { key: string; label: string; status?: ContactStatus }[];

export type InboxView = (typeof INBOX_VIEWS)[number]['key'];

export const INBOX_PAGE_SIZE = 25;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional().catch(undefined));

const searchSchema = z.object({
  view: z.preprocess(
    first,
    z.enum(INBOX_VIEWS.map((v) => v.key) as [InboxView, ...InboxView[]]).catch('new'),
  ),
  topic: optional(z.enum(TOPICS as [ContactTopic, ...ContactTopic[]])),
  q: optional(z.string().trim().min(1).max(100)),
  before: optional(z.uuid()),
});

export interface InboxQuery {
  view: InboxView;
  topic?: ContactTopic;
  q?: string;
  before?: string;
}

export function parseInboxQuery(params: Record<string, unknown>): InboxQuery {
  const parsed = searchSchema.parse(params);
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  ) as unknown as InboxQuery;
}

export const toApiQuery = (query: InboxQuery) => ({
  status: INBOX_VIEWS.find((v) => v.key === query.view)?.status,
  topic: query.topic,
  q: query.q,
  before: query.before,
  limit: INBOX_PAGE_SIZE,
});

/** `/inbox?…` with `change` applied (undefined removes a key). */
export function inboxHref(
  query: InboxQuery,
  change: Partial<Record<keyof InboxQuery, string | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...change })) {
    if (value === undefined || value === '') continue;
    if (key === 'view' && value === 'new') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `/inbox?${search}` : '/inbox';
}

/** A Pakistani mobile in E.164 → its WhatsApp chat link. */
export const whatsappHref = (e164: string): string => `https://wa.me/${e164.replace(/^\+/, '')}`;
