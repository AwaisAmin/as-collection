import type { AdminProductDto, AdminReviewCountsDto, AdminReviewListDto } from '@as/contracts';
import { X } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { TabsNav } from '@/components/ui/tabs-nav';
import { ReviewCard } from '@/features/reviews/components/review-card';
import { ReviewFilters } from '@/features/reviews/components/review-filters';
import {
  parseReviewQuery,
  REVIEW_VIEWS,
  reviewListHref,
  toApiQuery,
  viewCount,
} from '@/features/reviews/query';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Reviews' };

export default async function ReviewsPage({ searchParams }: PageProps<'/reviews'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'reviews.moderate')) {
    return <Alert tone="error">Your role does not include reviews.</Alert>;
  }
  const query = parseReviewQuery(await searchParams);
  const [list, counts, product] = await Promise.all([
    apiRequest<AdminReviewListDto>('/admin/reviews', { token, query: toApiQuery(query) }).catch(
      () => null,
    ),
    apiRequest<AdminReviewCountsDto>('/admin/reviews/counts', { token }).catch(() => null),
    query.product && can(permissions, 'catalog.read')
      ? apiFindOrNull<AdminProductDto>(`/admin/products/${query.product}`, { token }).catch(
          () => null,
        )
      : null,
  ]);
  const filtered = Boolean(query.q || query.rating || query.featured || query.product);
  const empty =
    query.view === 'pending' && !filtered
      ? { title: 'Nothing waiting', text: 'New reviews from customers appear here first.' }
      : filtered
        ? { title: 'No reviews match', text: 'Try a different search or clear the filters.' }
        : { title: 'Nothing here', text: 'Reviews in this list will appear here.' };
  const canSeeOrders = can(permissions, 'orders.read');

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Reviews</h1>
        <p className="text-[14px] text-muted">
          Customer reviews wait here until published. Only published reviews count in ratings.
        </p>
      </div>

      <TabsNav
        label="Review lists"
        tabs={REVIEW_VIEWS.map((view) => ({
          href: reviewListHref({ view: view.key, product: query.product }, {}),
          label: view.label,
          active: view.key === query.view,
          count: viewCount(view.key, counts),
        }))}
      />
      <ReviewFilters query={query} />
      {query.product ? (
        <p className="flex flex-wrap items-center gap-2 text-[14px]">
          Reviews of <span className="font-medium">{product?.name ?? 'one product'}</span>
          <Link
            href={reviewListHref(query, { product: undefined, before: undefined }) as Route}
            className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:text-text hover:underline"
          >
            <X aria-hidden size={14} />
            All products
          </Link>
        </p>
      ) : null}

      {!list ? (
        <Alert tone="error">Reviews could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ul className="flex flex-col gap-3">
            {list.items.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} canSeeOrders={canSeeOrders} />
              </li>
            ))}
          </ul>
          {query.before || list.nextCursor ? (
            <nav aria-label="More reviews" className="flex flex-wrap justify-between gap-2">
              {query.before ? (
                <ButtonLink
                  variant="secondary"
                  href={reviewListHref(query, { before: undefined }) as Route}
                >
                  Newest
                </ButtonLink>
              ) : (
                <span />
              )}
              {list.nextCursor ? (
                <ButtonLink
                  variant="secondary"
                  href={reviewListHref(query, { before: list.nextCursor }) as Route}
                >
                  Older reviews
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{empty.title}</p>
          <p className="text-[14px] text-muted">{empty.text}</p>
        </div>
      )}
    </div>
  );
}
