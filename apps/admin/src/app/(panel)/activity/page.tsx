import type { AdminAuditListDto, AdminStaffDto } from '@as/contracts';
import { X } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  actionLabel,
  activityHref,
  ALERT_ACTIONS,
  AREAS,
  changeLines,
  entityHref,
  parseActivityQuery,
  toApiQuery,
} from '@/features/activity/labels';
import { apiRequest } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Activity log' };

export default async function ActivityPage({ searchParams }: PageProps<'/activity'>) {
  const { token, permissions, staff: me } = await requireStaff();
  if (!can(permissions, 'audit.read')) {
    return <Alert tone="error">Your role does not include the activity log.</Alert>;
  }
  const query = parseActivityQuery(await searchParams);
  const [list, staff] = await Promise.all([
    apiRequest<AdminAuditListDto>('/admin/audit-logs', { token, query: toApiQuery(query) }).catch(
      () => null,
    ),
    // Names for the "who" filter; without staff access only "me" is offered.
    can(permissions, 'staff.manage')
      ? apiRequest<AdminStaffDto[]>('/admin/staff', { token }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const people = staff.length ? staff : [{ id: me.id, name: `${me.name} (you)` }];
  const filtered = Boolean(query.area || query.actor || query.record);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Activity log</h1>
        <p className="text-[14px] text-muted">
          Every change made in the admin, who made it and when. Entries can’t be edited or deleted.
        </p>
      </div>

      <form action="/activity" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {query.record ? <input type="hidden" name="record" value={query.record} /> : null}
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium">Area</span>
          <Select name="area" defaultValue={query.area ?? ''}>
            <option value="">Everything</option>
            {Object.entries(AREAS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium">Who</span>
          <Select name="actor" defaultValue={query.actor ?? ''}>
            <option value="">Anyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            Apply
          </Button>
          {filtered ? (
            <Link
              href="/activity"
              className="inline-flex h-10 items-center px-2 text-[14px] text-muted underline-offset-4 hover:text-text hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      {query.record ? (
        <p className="flex flex-wrap items-center gap-2 text-[14px]">
          Showing one record’s history
          <Link
            href={activityHref(query, { record: undefined, before: undefined }) as Route}
            className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:text-text hover:underline"
          >
            <X aria-hidden size={14} />
            Show everything
          </Link>
        </p>
      ) : null}

      {!list ? (
        <Alert tone="error">The log could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ol className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
            {list.items.map((entry) => {
              const href = entityHref(entry);
              const lines = changeLines(entry.changes);
              const who =
                entry.actorStaff?.name ??
                (entry.actorType === 'SYSTEM'
                  ? 'System'
                  : entry.actorType === 'CUSTOMER'
                    ? 'A customer'
                    : 'Removed staff member');
              return (
                <li key={entry.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[14px]">
                      <span className="font-medium">{who}</span>{' '}
                      <span>
                        {actionLabel(entry.action).replace(/^\w/, (c) => c.toLowerCase())}
                      </span>
                      {ALERT_ACTIONS.has(entry.action) ? (
                        <>
                          {' '}
                          <Badge tone="warning">Check</Badge>
                        </>
                      ) : null}
                    </p>
                    <time dateTime={entry.createdAt} className="text-[13px] text-muted">
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    <span>{AREAS[entry.entityType] ?? entry.entityType}</span>
                    {href ? (
                      <Link
                        href={href as Route}
                        className="text-text underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    ) : null}
                    {entry.entityId ? (
                      <Link
                        href={
                          activityHref(
                            { area: entry.entityType },
                            { record: entry.entityId },
                          ) as Route
                        }
                        className="underline-offset-4 hover:underline"
                      >
                        History
                      </Link>
                    ) : null}
                  </div>
                  {lines.length ? (
                    <ul className="text-[13px] wrap-break-word">
                      {lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <details className="text-[13px] text-muted">
                    <summary className="w-fit cursor-pointer">Details</summary>
                    <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                      <dt>Action</dt>
                      <dd className="font-mono">{entry.action}</dd>
                      {entry.ipAddress ? (
                        <>
                          <dt>IP address</dt>
                          <dd className="font-mono">{entry.ipAddress}</dd>
                        </>
                      ) : null}
                      {entry.userAgent ? (
                        <>
                          <dt>Browser</dt>
                          <dd className="break-all">{entry.userAgent}</dd>
                        </>
                      ) : null}
                      {entry.requestId ? (
                        <>
                          <dt>Request</dt>
                          <dd className="font-mono break-all">{entry.requestId}</dd>
                        </>
                      ) : null}
                    </dl>
                    {entry.changes ? (
                      <pre className="bg-canvas mt-2 max-h-64 overflow-auto rounded-lg p-3 text-[12px] break-all whitespace-pre-wrap">
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ol>
          {query.before || list.nextCursor ? (
            <nav aria-label="More activity" className="flex flex-wrap justify-between gap-2">
              {query.before ? (
                <ButtonLink
                  variant="secondary"
                  href={activityHref(query, { before: undefined }) as Route}
                >
                  Newest
                </ButtonLink>
              ) : (
                <span />
              )}
              {list.nextCursor ? (
                <ButtonLink
                  variant="secondary"
                  href={activityHref(query, { before: list.nextCursor }) as Route}
                >
                  Older
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{filtered ? 'Nothing matches' : 'Nothing logged yet'}</p>
          <p className="text-[14px] text-muted">
            {filtered ? 'Try another area or person.' : 'Changes made in the admin appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
