import { MessageSquareHeart } from 'lucide-react';

import { SectionHeading } from '@/components/ui/section-heading';
import { reviewsService } from '@/features/catalog/services/reviews.service';

import { ReviewList } from './review-list';
import { ReviewSummary } from './review-summary';
import { WriteReview } from './write-review';

interface ProductReviewsProps {
  productSlug: string;
  productName: string;
}

/** Reviews section: summary + write button (left), sortable/paginated list (right). */
export async function ProductReviews({ productSlug, productName }: ProductReviewsProps) {
  const [summary, firstPage] = await Promise.all([
    reviewsService.getSummary(productSlug),
    reviewsService.listReviews(productSlug, { sort: 'newest', page: 1 }),
  ]);

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-20 scroll-mt-6">
      <div id="reviews-title">
        <SectionHeading title="Customer Reviews" />
      </div>

      {summary.count === 0 ? (
        <div className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-4 rounded-card border border-dashed border-gold/70 bg-ivory px-6 py-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-full border border-gold bg-cream">
            <MessageSquareHeart aria-hidden className="size-7 text-gold-dark" strokeWidth={1.5} />
          </span>
          <p className="font-display text-[24px]">No reviews yet</p>
          <p className="text-[17px] text-muted">
            Bought this piece? Share your thoughts and help other shoppers.
          </p>
          <WriteReview productSlug={productSlug} productName={productName} first />
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
          <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-card border border-gold/60 bg-ivory p-6">
              <ReviewSummary summary={summary} />
            </div>
            <div className="flex flex-col gap-2 rounded-card border border-gold/60 bg-sand/60 p-6">
              <p className="font-display text-[19px]">Share your thoughts</p>
              <p className="mb-2 text-[16px] text-muted">
                Tell other shoppers about the fit, fabric and finish.
              </p>
              <WriteReview productSlug={productSlug} productName={productName} />
            </div>
          </div>
          <ReviewList productSlug={productSlug} initial={firstPage} />
        </div>
      )}
    </section>
  );
}
