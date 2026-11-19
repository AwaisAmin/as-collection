'use client';

import { BadgeCheck, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

import { RatingStars } from '@/components/ui/rating-stars';
import type { Review } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';

export function ReviewCard({ review }: { review: Review }) {
  // Optimistic local vote; persisted via the API once reviews move server-side.
  const [voted, setVoted] = useState(false);
  const helpful = review.helpfulCount + (voted ? 1 : 0);

  return (
    <article className="flex flex-col gap-3 border-b border-gold/40 py-6 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RatingStars value={review.rating} size={17} />
        <time dateTime={review.createdAt} className="text-[15px] text-muted">
          {formatDate(review.createdAt)}
        </time>
      </div>

      <h3 className="font-display text-[19px] leading-snug text-ink">{review.title}</h3>
      <p className="text-[17px] leading-relaxed text-text">{review.body}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
          <span className="font-bold text-ink">{review.author}</span>
          {review.city ? <span className="text-muted">{review.city}</span> : null}
          {review.verifiedPurchase ? (
            <span className="inline-flex items-center gap-1 font-semibold text-gold-dark">
              <BadgeCheck aria-hidden size={16} />
              Verified purchase
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setVoted((v) => !v)}
          aria-pressed={voted}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-body text-[14px] font-semibold transition-colors',
            voted
              ? 'border-gold bg-ink text-white'
              : 'border-gold/60 text-muted hover:border-gold hover:text-ink',
          )}
        >
          <ThumbsUp aria-hidden size={14} />
          Helpful ({helpful})
        </button>
      </div>
    </article>
  );
}
