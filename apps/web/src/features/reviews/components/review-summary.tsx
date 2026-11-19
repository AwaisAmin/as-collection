import { RatingStars } from '@/components/ui/rating-stars';
import type { ReviewSummary as Summary } from '@/features/catalog/types';
import { pluralize } from '@/lib/utils/format';

/** Average score, stars, count and a 5★→1★ distribution bar chart. */
export function ReviewSummary({ summary }: { summary: Summary }) {
  const max = Math.max(1, ...summary.distribution);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <p className="font-display text-[56px] leading-none text-ink">
          {summary.average.toFixed(1)}
        </p>
        <div className="flex flex-col gap-1">
          <RatingStars value={summary.average} size={20} />
          <p className="text-[16px] text-muted">Based on {pluralize(summary.count, 'review')}</p>
        </div>
      </div>

      <ul aria-label="Rating breakdown" className="flex flex-col gap-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary.distribution[stars - 1] ?? 0;
          const percent = summary.count ? Math.round((count / summary.count) * 100) : 0;
          return (
            <li
              key={stars}
              className="grid grid-cols-[52px_1fr_32px] items-center gap-3 font-body text-[15px]"
            >
              <span className="text-text">
                {stars}{' '}
                <span aria-hidden className="text-gold">
                  ★
                </span>
                <span className="sr-only">{stars === 1 ? 'star' : 'stars'}</span>
              </span>
              <span
                role="img"
                aria-label={`${percent}% of reviews`}
                className="h-2.5 overflow-hidden rounded-full bg-sand ring-1 ring-gold/30"
              >
                <span
                  className="block h-full rounded-full bg-gold-gradient"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-muted">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
