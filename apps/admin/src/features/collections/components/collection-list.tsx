'use client';

import type { AdminCollectionDto } from '@as/contracts';
import { ArrowDown, ArrowUp, ImageOff } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

import { reorderCollections } from '../actions';
import { COLLECTION_STATE } from '../labels';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

function when(collection: AdminCollectionDto): string | null {
  if (collection.state === 'scheduled' && collection.startsAt) {
    return `starts ${formatDateTime(collection.startsAt)}`;
  }
  if (collection.state === 'ended' && collection.endsAt) {
    return `ended ${formatDateTime(collection.endsAt)}`;
  }
  if (collection.state === 'live' && collection.endsAt) {
    return `until ${formatDateTime(collection.endsAt)}`;
  }
  return null;
}

/** Collections in display order with their state; the order saves at once. */
export function CollectionList({
  collections,
  canWrite,
}: {
  collections: readonly AdminCollectionDto[];
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const ids = collections.map((c) => c.id);
  const move = (index: number, by: -1 | 1) => {
    const next = [...ids];
    const [id] = next.splice(index, 1);
    if (id) next.splice(index + by, 0, id);
    start(async () => {
      const result = await reorderCollections(next);
      if (result.error) toast.error(result.error);
    });
  };

  return (
    <ul
      className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border"
      aria-busy={pending}
      data-testid="collection-list"
    >
      {collections.map((collection, index) => {
        const state = COLLECTION_STATE[collection.state];
        const time = when(collection);
        return (
          <li key={collection.id} className="flex items-center gap-3 px-4 py-3">
            <span className="border-line bg-canvas flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {collection.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                <img src={collection.image.url} alt="" className="size-full object-cover" />
              ) : (
                <ImageOff aria-hidden size={16} className="text-muted" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/collections/${collection.id}` as Route}
                  className="font-medium hover:underline"
                >
                  {collection.name}
                </Link>
                <Badge tone={state.tone}>{state.label}</Badge>
              </div>
              <p className="text-[13px] text-muted">
                {collection.type === 'MANUAL' ? 'Hand-picked' : 'Automatic'} ·{' '}
                {collection.productCount} {collection.productCount === 1 ? 'product' : 'products'}
                {time ? ` · ${time}` : ''}
              </p>
            </div>
            {canWrite ? (
              <div className="flex shrink-0">
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                  title="Move up"
                >
                  <ArrowUp aria-hidden size={16} />
                  <span className="sr-only">Move {collection.name} up</span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === collections.length - 1}
                  onClick={() => move(index, 1)}
                  title="Move down"
                >
                  <ArrowDown aria-hidden size={16} />
                  <span className="sr-only">Move {collection.name} down</span>
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
