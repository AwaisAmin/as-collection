import type { AdminInboxCountsDto, AdminInboxListDto } from '@as/contracts';
import { Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TabsNav } from '@/components/ui/tabs-nav';
import {
  INBOX_VIEWS,
  inboxHref,
  MESSAGE_STATUS,
  parseInboxQuery,
  toApiQuery,
  TOPIC_LABEL,
  TOPICS,
} from '@/features/inbox/labels';
import { apiRequest } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Inbox' };

export default async function InboxPage({ searchParams }: PageProps<'/inbox'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'inbox.read')) {
    return <Alert tone="error">Your role does not include the inbox.</Alert>;
  }
  const query = parseInboxQuery(await searchParams);
  const [list, counts] = await Promise.all([
    apiRequest<AdminInboxListDto>('/admin/inbox', { token, query: toApiQuery(query) }).catch(
      () => null,
    ),
    apiRequest<AdminInboxCountsDto>('/admin/inbox/counts', { token }).catch(() => null),
  ]);
  const filtered = Boolean(query.q || query.topic);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Inbox</h1>
        <p className="text-[14px] text-muted">
          Messages from the shop’s contact form. Opening a new message marks it read.
        </p>
      </div>

      <TabsNav
        label="Inbox lists"
        tabs={INBOX_VIEWS.map((view) => ({
          href: inboxHref({ view: view.key }, {}),
          label: view.label,
          active: view.key === query.view,
          count: view.key === 'new' ? (counts?.NEW ?? null) : null,
        }))}
      />

      <form action="/inbox" className="flex flex-col gap-3 lg:flex-row lg:items-end" role="search">
        {query.view !== 'new' ? <input type="hidden" name="view" value={query.view} /> : null}
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium">Search</span>
          <span className="relative">
            <Search
              aria-hidden
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Name, email, phone, order number or words"
              maxLength={100}
              className="pl-9"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 lg:w-52">
          <span className="text-[13px] font-medium">About</span>
          <Select name="topic" defaultValue={query.topic ?? ''}>
            <option value="">Any topic</option>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {TOPIC_LABEL[topic]}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            Apply
          </Button>
          {filtered ? (
            <Link
              href={inboxHref({ view: query.view }, {}) as Route}
              className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {!list ? (
        <Alert tone="error">The inbox could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
            {list.items.map((message) => {
              const unread = message.status === 'NEW';
              return (
                <li key={message.id} className="hover:bg-canvas/50 relative px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link
                      href={`/inbox/${message.id}` as Route}
                      className={cn(
                        'min-w-0 break-words after:absolute after:inset-0 hover:underline',
                        unread ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {message.subject ?? TOPIC_LABEL[message.topic]}
                    </Link>
                    <span className="text-[13px] text-muted">
                      {formatDateTime(message.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    <span className={unread ? 'text-text' : undefined}>{message.name}</span>
                    <span>· {TOPIC_LABEL[message.topic]}</span>
                    {message.orderNumber ? <span>· {message.orderNumber}</span> : null}
                    {message.status !== 'READ' ? (
                      <Badge tone={MESSAGE_STATUS[message.status].tone}>
                        {MESSAGE_STATUS[message.status].label}
                      </Badge>
                    ) : null}
                    {message.staffNote ? <Badge>Has note</Badge> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[14px] break-words text-muted">
                    {message.preview}
                  </p>
                </li>
              );
            })}
          </ul>
          {query.before || list.nextCursor ? (
            <nav aria-label="More messages" className="flex flex-wrap justify-between gap-2">
              {query.before ? (
                <ButtonLink
                  variant="secondary"
                  href={inboxHref(query, { before: undefined }) as Route}
                >
                  Newest
                </ButtonLink>
              ) : (
                <span />
              )}
              {list.nextCursor ? (
                <ButtonLink
                  variant="secondary"
                  href={inboxHref(query, { before: list.nextCursor }) as Route}
                >
                  Older messages
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">
            {filtered
              ? 'No messages match'
              : query.view === 'new'
                ? 'All caught up'
                : 'Nothing here'}
          </p>
          <p className="text-[14px] text-muted">
            {filtered
              ? 'Try a different search or clear the filters.'
              : query.view === 'new'
                ? 'New messages from the contact form appear here.'
                : 'Messages in this list will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
