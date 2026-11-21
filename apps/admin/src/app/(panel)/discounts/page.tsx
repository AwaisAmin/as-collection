import type { AdminDiscountListDto, DiscountState } from '@as/contracts';
import { Plus, Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TabsNav } from '@/components/ui/tabs-nav';
import {
  DISCOUNT_READ,
  DISCOUNT_STATES,
  discountSummary,
  usageText,
} from '@/features/discounts/labels';
import { apiRequest } from '@/lib/api/http-client';
import { formatDate } from '@/lib/format';
import { can, canAny } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Discounts' };

const PAGE_SIZE = 25;
const STATES: readonly ('all' | DiscountState)[] = [
  'all',
  'active',
  'scheduled',
  'expired',
  'used-up',
  'inactive',
];

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const querySchema = z.object({
  state: z.preprocess(
    first,
    z.enum(['active', 'scheduled', 'expired', 'used-up', 'inactive']).optional().catch(undefined),
  ),
  q: z.preprocess(first, z.string().trim().min(1).max(40).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});
type Query = z.infer<typeof querySchema>;

function href(query: Query, change: Partial<Query>): string {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.state) params.set('state', next.state);
  if (next.q) params.set('q', next.q);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `/discounts?${search}` : '/discounts';
}

function validity(d: { startsAt: string | null; endsAt: string | null }): string | null {
  if (d.startsAt && d.endsAt) return `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`;
  if (d.startsAt) return `from ${formatDate(d.startsAt)}`;
  if (d.endsAt) return `until ${formatDate(d.endsAt)}`;
  return null;
}

export default async function DiscountsPage({ searchParams }: PageProps<'/discounts'>) {
  const { token, permissions } = await requireStaff();
  if (!canAny(permissions, DISCOUNT_READ)) {
    return <Alert tone="error">Your role does not include discounts.</Alert>;
  }
  const params = await searchParams;
  const query = querySchema.parse(params);
  const list = await apiRequest<AdminDiscountListDto>('/admin/discounts', {
    token,
    query: { state: query.state, q: query.q, page: query.page, pageSize: PAGE_SIZE },
  }).catch(() => null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Discounts</h1>
          <p className="text-[14px] text-muted">Codes customers enter at checkout.</p>
        </div>
        {can(permissions, 'discounts.write') ? (
          <ButtonLink href="/discounts/new">
            <Plus aria-hidden size={17} />
            New discount
          </ButtonLink>
        ) : null}
      </div>
      {params.deleted === '1' ? <Alert tone="success">The discount was deleted.</Alert> : null}

      <TabsNav
        label="Discount states"
        tabs={STATES.map((state) => ({
          href: href(query, { state: state === 'all' ? undefined : state }),
          label: state === 'all' ? 'All' : DISCOUNT_STATES[state].label,
          active: (query.state ?? 'all') === state,
        }))}
      />

      <form action="/discounts" role="search" className="flex gap-2 sm:max-w-md">
        {query.state ? <input type="hidden" name="state" value={query.state} /> : null}
        <span className="relative flex-1">
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Code starts with…"
            aria-label="Search codes"
            maxLength={40}
            className="pl-9 uppercase placeholder:normal-case"
          />
        </span>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {!list ? (
        <Alert tone="error">Discounts could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
            {list.items.map((discount) => {
              const state = DISCOUNT_STATES[discount.state];
              const dates = validity(discount);
              return (
                <li key={discount.id} className="hover:bg-canvas/50 relative px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/discounts/${discount.id}` as Route}
                      className="font-mono font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {discount.code}
                    </Link>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </div>
                  <p className="text-[14px]">{discountSummary(discount)}</p>
                  <p className="text-[13px] text-muted">
                    {usageText(discount)}
                    {dates ? ` · ${dates}` : ''}
                    {discount.description ? ` · ${discount.description}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            pageSize={PAGE_SIZE}
            href={(page) => href(query, { page })}
          />
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">
            {query.q || query.state ? 'No codes match' : 'No codes yet'}
          </p>
          <p className="text-[14px] text-muted">
            {query.q || query.state
              ? 'Try another search or tab.'
              : 'Create one for a sale or a campaign.'}
          </p>
        </div>
      )}
    </div>
  );
}
