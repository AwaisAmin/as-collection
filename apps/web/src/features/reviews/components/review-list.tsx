'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { type ReviewSort, reviewSortOptions } from '@/features/catalog/schemas';
import type { Paginated, Review } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

import { loadReviews } from '../actions';
import { ReviewCard } from './review-card';

interface ReviewListProps {
  productId: string;
  /** First page, server-rendered (indexable, no loading flash). */
  initial: Paginated<Review>;
}

export function ReviewList({ productId, initial }: ReviewListProps) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [pageCount, setPageCount] = useState(initial.pageCount);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [isPending, startTransition] = useTransition();
  const sortId = useId();

  function fetchPage(nextSort: ReviewSort, nextPage: number) {
    startTransition(async () => {
      const result = await loadReviews(productId, nextSort, nextPage);
      if (!result) {
        toast.error("Couldn't load reviews. Please try again.");
        return;
      }
      setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
      setPage(result.page);
      setPageCount(result.pageCount);
      setSort(nextSort);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-gold/40 pb-4">
        <p className="text-[16px] text-muted">
          Showing {items.length} of {initial.total}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="hidden text-[15px] text-muted sm:inline">
            Sort by
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={sort}
              disabled={isPending}
              onChange={(e) => fetchPage(e.target.value as ReviewSort, 1)}
              className="h-10 cursor-pointer appearance-none rounded-full border border-gold bg-ivory pr-10 pl-4 font-body text-[15px] font-semibold text-text focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]"
            >
              {reviewSortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              size={16}
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
            />
          </div>
        </div>
      </div>

      <div
        aria-busy={isPending}
        aria-live="polite"
        className={cn('transition-opacity duration-200', isPending && 'opacity-50')}
      >
        {items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {page < pageCount ? (
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => fetchPage(sort, page + 1)}
          >
            {isPending ? 'Loading…' : 'Load more reviews'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
