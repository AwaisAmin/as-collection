'use client';

import { BadgeCheck, ThumbsUp } from 'lucide-react';
import { useState, useTransition } from 'react';

import { RatingStars } from '@/components/ui/rating-stars';
import type { Review } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';

import { markReviewHelpful } from '../actions';
import { rememberHelpfulVote, useHelpfulVote } from '../helpful-votes';

export function ReviewCard({ review }: { review: Review }) {
  // One vote per shopper (the API ignores repeats), shown optimistically and remembered in this
  // browser, so a reload within the review cache's lifetime still shows it.
  const remembered = useHelpfulVote(review.id);
  const [votedNow, setVotedNow] = useState(false);
  const [countNow, setCountNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const voted = votedNow || remembered !== null;
  const count = Math.max(review.helpfulCount, countNow ?? 0, remembered ?? 0);

  const vote = () => {
    if (voted) return;
    setVotedNow(true);
    setCountNow(review.helpfulCount + 1);
    startTransition(async () => {
      const confirmed = await markReviewHelpful(review.id);
      if (confirmed !== null) {
        setCountNow(confirmed);
        rememberHelpfulVote(review.id, confirmed);
      }
    });
  };

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

      {review.reply ? (
        <div className="rounded-xl border-l-4 border-gold bg-white/70 px-4 py-3">
          <p className="text-[14px] font-bold tracking-wide text-gold-dark uppercase">
            Reply from AS Collection Hub
          </p>
          <p className="mt-1 text-[16px] leading-relaxed text-text">{review.reply.body}</p>
        </div>
      ) : null}

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
          onClick={vote}
          disabled={voted || pending}
          aria-pressed={voted}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-body text-[14px] font-semibold transition-colors',
            voted
              ? 'border-gold bg-ink text-white'
              : 'border-gold/60 text-muted hover:border-gold hover:text-ink',
            'disabled:cursor-default',
          )}
        >
          <ThumbsUp aria-hidden size={14} />
          Helpful ({count})
        </button>
      </div>
    </article>
  );
}
