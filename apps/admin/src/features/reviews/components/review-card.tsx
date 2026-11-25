'use client';

import type { AdminReviewDto } from '@as/contracts';
import { BadgeCheck, Star, ThumbsUp } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import type { ActionState } from '@/lib/action-state';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import {
  approveReview,
  deleteReview,
  featureReview,
  rejectReview,
  replyToReview,
} from '../actions';

const STATUS = {
  PENDING: { label: 'Waiting', tone: 'warning' },
  APPROVED: { label: 'Published', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
} as const;

export function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          size={15}
          className={n <= rating ? 'fill-gold text-gold' : 'text-line'}
        />
      ))}
    </span>
  );
}

/** One review with everything needed to decide on it, and the decisions its state allows. */
export function ReviewCard({
  review,
  canSeeOrders,
}: {
  review: AdminReviewDto;
  canSeeOrders: boolean;
}) {
  const id = useId();
  const [pending, start] = useTransition();
  const status = STATUS[review.status];
  const name = `“${review.title}”`;

  const run = (work: () => Promise<ActionState>) =>
    start(async () => {
      const result = await work();
      if (result.done) toast.success(result.done);
      else if (result.error) toast.error(result.error);
    });

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-2">
        <Stars rating={review.rating} />
        <Badge tone={status.tone}>{status.label}</Badge>
        {review.isFeatured ? <Badge tone="gold">On the home page</Badge> : null}
        {review.isVerifiedPurchase ? (
          <Badge tone="success">
            <BadgeCheck aria-hidden size={12} className="mr-1" />
            Verified purchase
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-semibold break-words">
          {review.title}
        </h2>
        <p className="text-[14px] break-words whitespace-pre-line">{review.body}</p>
      </div>

      <p className="text-[13px] text-muted">
        {review.authorName}
        {review.city ? `, ${review.city}` : ''} · {formatDate(review.createdAt)} ·{' '}
        <Link
          href={`/products/${review.product.id}` as Route}
          className="text-text underline-offset-4 hover:underline"
        >
          {review.product.name}
        </Link>
        {review.orderNumber ? (
          <>
            {' · '}
            {canSeeOrders ? (
              <Link
                href={`/orders/${review.orderNumber}` as Route}
                className="text-text underline-offset-4 hover:underline"
              >
                {review.orderNumber}
              </Link>
            ) : (
              review.orderNumber
            )}
          </>
        ) : null}
        {review.helpfulCount ? (
          <>
            {' · '}
            <ThumbsUp aria-hidden size={12} className="inline align-[-1px]" /> {review.helpfulCount}{' '}
            found it helpful
          </>
        ) : null}
      </p>

      {review.status === 'REJECTED' && review.rejectionReason ? (
        <p className="bg-danger/5 text-danger rounded-lg px-3 py-2 text-[13px]">
          <span className="font-medium">Reason (staff only):</span> {review.rejectionReason}
          {review.moderatedBy ? ` — ${review.moderatedBy.name}` : ''}
          {review.moderatedAt ? `, ${formatDateTime(review.moderatedAt)}` : ''}
        </p>
      ) : null}

      {review.reply ? (
        <div className="bg-canvas rounded-r-lg border-l-2 border-gold/60 px-3 py-2 text-[14px]">
          <p className="text-[12px] font-medium text-muted">
            Store reply{review.repliedBy ? ` by ${review.repliedBy.name}` : ''}
            {review.repliedAt ? `, ${formatDateTime(review.repliedAt)}` : ''}
          </p>
          <p className="break-words whitespace-pre-line">{review.reply}</p>
        </div>
      ) : null}

      <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap', pending && 'opacity-70')}>
        {review.status !== 'APPROVED' ? (
          <Button
            disabled={pending}
            onClick={() => run(() => approveReview(review.id))}
            className="w-full sm:w-auto"
            aria-label={`Publish ${name}`}
          >
            Publish
          </Button>
        ) : null}
        {review.status !== 'REJECTED' ? (
          <ActionDialog
            trigger={review.status === 'APPROVED' ? 'Unpublish' : 'Reject'}
            triggerLabel={`${review.status === 'APPROVED' ? 'Unpublish' : 'Reject'} ${name}`}
            disabled={pending}
            title={review.status === 'APPROVED' ? 'Unpublish review' : 'Reject review'}
            description="It leaves the shop and the product rating. The review is kept, so it can be published later."
            submitLabel={review.status === 'APPROVED' ? 'Unpublish' : 'Reject'}
            submitVariant="danger"
            action={rejectReview.bind(null, review.id)}
          >
            {(errors) => (
              <Field
                id={`${id}-reason`}
                label="Reason"
                hint="Only staff see it, e.g. spam, abusive, not about the product."
                error={errors.reason}
                required
              >
                {(control) => (
                  <Textarea {...control} name="reason" rows={2} maxLength={300} required />
                )}
              </Field>
            )}
          </ActionDialog>
        ) : null}
        {review.status === 'APPROVED' ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => featureReview(review.id, !review.isFeatured))}
            className="w-full sm:w-auto"
            aria-label={`${review.isFeatured ? 'Remove' : 'Show'} ${name} ${review.isFeatured ? 'from' : 'on'} the home page`}
          >
            {review.isFeatured ? 'Remove from home page' : 'Show on home page'}
          </Button>
        ) : null}
        <ActionDialog
          trigger={review.reply ? 'Edit reply' : 'Reply'}
          triggerLabel={`${review.reply ? 'Edit reply to' : 'Reply to'} ${name}`}
          disabled={pending}
          title={review.reply ? 'Edit reply' : 'Reply to this review'}
          description={
            review.status === 'APPROVED'
              ? 'Shown under the review in the shop, signed by the store. Leave empty to remove it.'
              : 'Shown under the review once it is published. Leave empty to remove it.'
          }
          submitLabel="Save reply"
          action={replyToReview.bind(null, review.id)}
        >
          {(errors) => (
            <Field id={`${id}-reply`} label="Reply" error={errors.reply}>
              {(control) => (
                <Textarea
                  {...control}
                  name="reply"
                  rows={4}
                  maxLength={1000}
                  defaultValue={review.reply ?? ''}
                />
              )}
            </Field>
          )}
        </ActionDialog>
        {review.status !== 'APPROVED' ? (
          <ActionDialog
            trigger="Delete"
            triggerVariant="ghost"
            triggerLabel={`Delete ${name}`}
            triggerClassName="text-danger"
            disabled={pending}
            title="Delete review permanently"
            description="For spam only: it is removed for good and can’t be brought back. Rejecting keeps it on record."
            submitLabel="Delete permanently"
            submitVariant="danger"
            action={() => deleteReview(review.id)}
          />
        ) : null}
      </div>
    </Card>
  );
}
