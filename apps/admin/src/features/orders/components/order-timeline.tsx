import type { AdminOrderEventDto } from '@as/contracts';
import { Eye } from 'lucide-react';

import { formatDateTime } from '@/lib/format';

import { eventLabel } from '../labels';

const actorName = (event: AdminOrderEventDto) =>
  event.actor?.name ??
  (event.actorType === 'CUSTOMER' ? 'Customer' : event.actorType === 'SYSTEM' ? 'System' : 'Staff');

/** Everything that happened to the order, newest first. */
export function OrderTimeline({ events }: { events: readonly AdminOrderEventDto[] }) {
  const newestFirst = [...events].reverse();
  return (
    <ol className="flex flex-col">
      {newestFirst.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < newestFirst.length - 1 ? (
            <span aria-hidden className="bg-line absolute top-3 bottom-0 left-1.25 w-px" />
          ) : null}
          <span
            aria-hidden
            className={
              index === 0
                ? 'mt-1.5 size-2.75 shrink-0 rounded-full bg-gold-dark'
                : 'border-line bg-surface mt-1.5 size-2.75 shrink-0 rounded-full border-2'
            }
          />
          <div className="flex min-w-0 flex-col gap-0.5 text-[14px]">
            <p>
              <span className="font-medium">{eventLabel(event.type)}</span>
              <span className="text-muted"> · {actorName(event)}</span>
            </p>
            {event.note ? <p className="whitespace-pre-line">{event.note}</p> : null}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
              <time dateTime={event.at} className="whitespace-nowrap">
                {formatDateTime(event.at)}
              </time>
              {event.customerVisible ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-gold-dark">
                  <Eye aria-hidden size={13} />
                  Customer sees this
                </span>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
