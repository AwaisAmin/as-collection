import type { AdminOrderDto } from '@as/contracts';
import { TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatBytes, formatDateTime, formatMoney } from '@/lib/format';

import { PAYMENT_METHOD, PROOF_STATUS } from '../labels';
import { ProofReview } from './proof-review';

/** The customer's transfer screenshots, newest first, with accept / reject for the open one. */
export function PaymentProofs({
  order,
  canReview,
}: {
  order: AdminOrderDto;
  /** The staff member holds `payments.review`. */
  canReview: boolean;
}) {
  if (!order.paymentProofs.length) {
    return (
      <p className="text-[14px] text-muted">
        The customer has not uploaded a payment screenshot yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {order.paymentProofs.map((proof) => {
        const status = PROOF_STATUS[proof.status];
        const src = `/orders/${order.number}/proof/${proof.id}`;
        return (
          <li
            key={proof.id}
            className="border-line flex flex-col gap-4 rounded-lg border p-3 sm:flex-row"
          >
            {canReview ? (
              <a
                href={src}
                target="_blank"
                rel="noopener"
                className="border-line bg-canvas block shrink-0 overflow-hidden rounded-md border sm:w-40"
                title="Open full size"
              >
                {/* Streamed through our own authenticated route; the image optimizer can't
                    forward the staff session, so a plain <img> is the right tool here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Payment screenshot for ${order.number}`}
                  loading="lazy"
                  className="h-48 w-full object-contain sm:h-40"
                />
              </a>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-[14px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="text-muted">{PAYMENT_METHOD[proof.method]}</span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">Amount</dt>
                <dd className="tabular-nums">
                  {proof.amountMinor === null ? '—' : formatMoney(proof.amountMinor)}
                  {proof.amountMismatch ? (
                    <span className="text-warning ml-2 inline-flex items-center gap-1">
                      <TriangleAlert aria-hidden size={14} />
                      Order total is {formatMoney(order.totals.totalMinor)}
                    </span>
                  ) : null}
                </dd>
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono break-all">{proof.reference ?? '—'}</dd>
                <dt className="text-muted">Uploaded</dt>
                <dd>
                  {formatDateTime(proof.uploadedAt)}
                  <span className="text-muted"> · {formatBytes(proof.sizeBytes)}</span>
                </dd>
                {proof.reviewedAt ? (
                  <>
                    <dt className="text-muted">Reviewed</dt>
                    <dd>
                      {formatDateTime(proof.reviewedAt)}
                      {proof.reviewedBy ? ` by ${proof.reviewedBy.name}` : ''}
                    </dd>
                  </>
                ) : null}
                {proof.note ? (
                  <>
                    <dt className="text-muted">Note</dt>
                    <dd className="whitespace-pre-line">{proof.note}</dd>
                  </>
                ) : null}
              </dl>
              {canReview && order.canReviewPayment && proof.status === 'PENDING' ? (
                <ProofReview number={order.number} proofId={proof.id} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
