import { BadgeCheck, Quote } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { Carousel } from '@/components/ui/carousel';
import { Container } from '@/components/ui/container';
import { RatingStars } from '@/components/ui/rating-stars';
import { SectionHeading } from '@/components/ui/section-heading';
import { productHref } from '@/features/catalog/lib/routes';
import { reviewsService } from '@/features/catalog/services/reviews.service';
import type { FeaturedReview } from '@/features/catalog/types';
import { pluralize } from '@/lib/utils/format';

function TestimonialCard({ review }: { review: FeaturedReview }) {
  return (
    <figure className="flex h-full flex-col gap-4 rounded-card border border-gold/60 bg-ivory p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <RatingStars value={review.rating} size={17} />
        <Quote aria-hidden size={30} className="text-gold/70" />
      </div>
      <blockquote className="flex flex-1 flex-col gap-2">
        <p className="font-display text-[19px]/snug text-ink">{review.title}</p>
        <p className="line-clamp-5 text-[17px] leading-relaxed text-text">{review.body}</p>
      </blockquote>
      <figcaption className="flex flex-col gap-1 border-t border-gold/40 pt-4 text-[15px]">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-ink">{review.author}</span>
          {review.city ? <span className="text-muted">· {review.city}</span> : null}
          {review.verifiedPurchase ? (
            <span className="inline-flex items-center gap-1 font-semibold text-gold-dark">
              <BadgeCheck aria-hidden size={15} />
              Verified
            </span>
          ) : null}
        </span>
        <span className="text-muted">
          on{' '}
          <Link
            href={productHref(review.product.slug)}
            className="font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold-dark"
          >
            {review.product.name}
          </Link>
        </span>
      </figcaption>
    </figure>
  );
}

/** Five-star verified reviews from across the store, with the overall rating. */
export async function Testimonials({
  title = 'Loved by Our Customers',
  limit = 8,
}: { title?: string; limit?: number } = {}) {
  const [reviews, summary] = await Promise.all([
    reviewsService.getFeaturedReviews(limit),
    reviewsService.getStoreSummary(),
  ]);
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-title" className="bg-cream py-16 lg:py-20">
      <Container>
        <Reveal className="flex flex-col items-center gap-4">
          <SectionHeading id="testimonials-title" title={title} />
          {summary.count > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[18px] text-muted">
              <RatingStars value={summary.average} size={18} />
              <span>
                <span className="font-semibold text-ink">{summary.average.toFixed(1)}</span> out of
                5 from {pluralize(summary.count, 'review')}
              </span>
            </div>
          ) : null}
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <Carousel
            label="Customer reviews"
            slideClassName="w-[86%] sm:w-[calc((100%-20px)/2)] lg:w-[calc((100%-40px)/3)]"
          >
            {reviews.map((review) => (
              <TestimonialCard key={review.id} review={review} />
            ))}
          </Carousel>
        </Reveal>
      </Container>
    </section>
  );
}
