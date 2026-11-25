import type {
  AdminSubscriberCountsDto,
  AdminSubscriberListDto,
  SubscriberStatus,
} from '@as/contracts';
import { Download, Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsNav } from '@/components/ui/tabs-nav';
import { apiRequest } from '@/lib/api/http-client';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Newsletter' };

const PAGE_SIZE = 50;
const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const querySchema = z.object({
  status: z.preprocess(first, z.enum(['SUBSCRIBED', 'UNSUBSCRIBED']).catch('SUBSCRIBED')),
  q: z.preprocess(first, z.string().trim().min(1).max(100).optional().catch(undefined)),
  before: z.preprocess(first, z.uuid().optional().catch(undefined)),
});

const SOURCE: Record<string, string> = {
  footer: 'Footer form',
  checkout: 'Checkout',
  account: 'Account',
  popup: 'Pop-up',
  other: 'Other',
};

function href(change: { status: SubscriberStatus; q?: string; before?: string }): string {
  const params = new URLSearchParams();
  if (change.status !== 'SUBSCRIBED') params.set('status', change.status);
  if (change.q) params.set('q', change.q);
  if (change.before) params.set('before', change.before);
  const search = params.toString();
  return search ? `/newsletter?${search}` : '/newsletter';
}

export default async function NewsletterPage({ searchParams }: PageProps<'/newsletter'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'newsletter.read')) {
    return <Alert tone="error">Your role does not include the newsletter.</Alert>;
  }
  const query = querySchema.parse(await searchParams);
  const [list, counts] = await Promise.all([
    apiRequest<AdminSubscriberListDto>('/admin/newsletter/subscribers', {
      token,
      query: { ...query, limit: PAGE_SIZE },
    }).catch(() => null),
    apiRequest<AdminSubscriberCountsDto>('/admin/newsletter/counts', { token }).catch(() => null),
  ]);
  const subscribed = query.status === 'SUBSCRIBED';
  const total = counts?.[query.status] ?? 0;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Newsletter</h1>
          <p className="text-[14px] text-muted">
            People who asked for news and offers by email. Download the list for your mailing tool.
          </p>
        </div>
        {/* A plain link: the browser downloads the file; the API records who exported it. */}
        <a
          href={`/newsletter/export?status=${query.status}`}
          download
          aria-disabled={total === 0 || undefined}
          className={buttonClasses(
            'secondary',
            'md',
            total === 0 ? 'pointer-events-none opacity-50' : undefined,
          )}
        >
          <Download aria-hidden size={16} />
          Download {subscribed ? 'subscribers' : 'unsubscribed'} (CSV)
        </a>
      </div>

      <TabsNav
        label="Subscriber lists"
        tabs={(['SUBSCRIBED', 'UNSUBSCRIBED'] as const).map((status) => ({
          href: href({ status }),
          label: `${status === 'SUBSCRIBED' ? 'Subscribed' : 'Unsubscribed'}${
            counts ? ` (${counts[status].toLocaleString('en-PK')})` : ''
          }`,
          active: status === query.status,
        }))}
      />

      <form action="/newsletter" className="flex gap-2" role="search">
        {!subscribed ? <input type="hidden" name="status" value={query.status} /> : null}
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="sr-only">Search by email</span>
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
              placeholder="Search by email"
              maxLength={100}
              className="pl-9"
            />
          </span>
        </label>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query.q ? (
          <Link
            href={href({ status: query.status }) as Route}
            className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {!list ? (
        <Alert tone="error">Subscribers could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <div className="border-line bg-surface shadow-card relative overflow-x-auto rounded-card border">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">
                {subscribed ? 'Subscribers' : 'Unsubscribed'}, newest first
              </caption>
              <thead className="border-line bg-canvas/60 border-b text-[13px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Email
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                    Signed up from
                  </th>
                  <th scope="col" className="w-px px-4 py-2.5 font-medium whitespace-nowrap">
                    {subscribed ? 'Joined' : 'Left'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {list.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 break-all">{s.email}</td>
                    <td className="hidden px-4 py-2.5 text-muted sm:table-cell">
                      {s.source ? (SOURCE[s.source] ?? s.source) : '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {formatDate(subscribed ? s.consentAt : (s.unsubscribedAt ?? s.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.before || list.nextCursor ? (
            <nav aria-label="More subscribers" className="flex flex-wrap justify-between gap-2">
              {query.before ? (
                <ButtonLink
                  variant="secondary"
                  href={href({ ...query, before: undefined }) as Route}
                >
                  Newest
                </ButtonLink>
              ) : (
                <span />
              )}
              {list.nextCursor ? (
                <ButtonLink
                  variant="secondary"
                  href={href({ ...query, before: list.nextCursor }) as Route}
                >
                  Older
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{query.q ? 'No emails match' : 'Nobody here yet'}</p>
          <p className="text-[14px] text-muted">
            {query.q
              ? 'Try a different search.'
              : subscribed
                ? 'People who sign up in the shop appear here.'
                : 'People who unsubscribe appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
