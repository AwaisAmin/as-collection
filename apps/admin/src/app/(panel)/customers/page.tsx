import type { AdminCustomerListDto } from '@as/contracts';
import { Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TabsNav } from '@/components/ui/tabs-nav';
import {
  CUSTOMER_PAGE_SIZE,
  CUSTOMER_STATUS,
  customerListHref,
  parseCustomerQuery,
} from '@/features/customers/labels';
import { apiRequest } from '@/lib/api/http-client';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: PageProps<'/customers'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'customers.read')) {
    return <Alert tone="error">Your role does not include customers.</Alert>;
  }
  const query = parseCustomerQuery(await searchParams);
  const list = await apiRequest<AdminCustomerListDto>('/admin/customers', {
    token,
    query: { ...query, pageSize: CUSTOMER_PAGE_SIZE },
  }).catch(() => null);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Customers</h1>
        <p className="text-[14px] text-muted">
          Shopper accounts with their orders and spending. Guest checkouts have no account.
        </p>
      </div>

      <TabsNav
        label="Customer lists"
        tabs={[
          { label: 'All', status: undefined },
          { label: 'Blocked', status: 'BLOCKED' as const },
        ].map((tab) => ({
          href: customerListHref({ page: 1 }, { status: tab.status }),
          label: tab.label,
          active: query.status === tab.status,
        }))}
      />

      <form action="/customers" className="flex gap-2" role="search">
        {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
        <label className="flex flex-1 flex-col">
          <span className="sr-only">Search customers</span>
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
              placeholder="Phone, email or name"
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
            href={customerListHref({ page: 1, status: query.status }, {}) as Route}
            className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {!list ? (
        <Alert tone="error">Customers could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
            {list.items.map((customer) => (
              <li
                key={customer.id}
                className="hover:bg-canvas/50 relative flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/customers/${customer.id}` as Route}
                      className="font-medium wrap-break-word after:absolute after:inset-0 hover:underline"
                    >
                      {customer.name ?? 'No name given'}
                    </Link>
                    {customer.status === 'BLOCKED' ? (
                      <Badge tone={CUSTOMER_STATUS.BLOCKED.tone}>Blocked</Badge>
                    ) : null}
                  </div>
                  <p className="text-[13px] break-all text-muted">
                    {[customer.phone ? formatPhone(customer.phone) : null, customer.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="text-[13px] text-muted sm:text-right">
                  <p>
                    <span className="font-medium text-text tabular-nums">
                      {formatMoney(customer.spentMinor)}
                    </span>{' '}
                    · {customer.orders} {customer.orders === 1 ? 'order' : 'orders'}
                  </p>
                  <p>
                    {customer.lastOrderAt
                      ? `Last order ${formatDate(customer.lastOrderAt)}`
                      : `Joined ${formatDate(customer.createdAt)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            pageSize={CUSTOMER_PAGE_SIZE}
            href={(page) => customerListHref(query, { page })}
          />
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">
            {query.q
              ? 'No customers match'
              : query.status
                ? 'No blocked accounts'
                : 'No customers yet'}
          </p>
          <p className="text-[14px] text-muted">
            {query.q
              ? 'Search by mobile number (any spelling), email or part of the name.'
              : query.status
                ? 'Blocked accounts appear here.'
                : 'Shoppers who create an account appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
