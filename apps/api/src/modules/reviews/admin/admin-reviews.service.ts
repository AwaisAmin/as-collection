import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { conflict, lockRow, notFound } from '../../../common/admin-write.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { clearableText, plainText } from '../../../common/text.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService } from '../../audit/audit.service.js';
import { CatalogService } from '../../catalog/catalog.service.js';
import { ReviewsService } from '../reviews.service.js';

// ─── Schemas ───

export const reviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const adminReviewsQuerySchema = z.object({
  status: z.enum(reviewStatuses).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  product: z.uuid().optional(),
  featured: z
    .enum(['1', 'true', '0', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  /** Words in the title, text or author name. */
  q: z.string().trim().min(1).max(100).optional(),
  /** Keyset paging: the last `id` of the previous page (newest first). */
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>;

export const rejectReviewSchema = z.object({
  /** Internal: why it was rejected (spam, abusive, off-topic…). */
  reason: plainText({ min: 3, max: 300 }),
});
export const featureReviewSchema = z.object({ featured: z.boolean() });
/** Public reply from the store; null or blank removes it. */
export const replyReviewSchema = z.object({ reply: clearableText({ max: 1000, multiline: true }) });

// ─── Service ───

const reviewNotFound = () => notFound('REVIEW_NOT_FOUND', 'Review not found.');

const adminReviewSelect = {
  id: true,
  status: true,
  rating: true,
  title: true,
  body: true,
  authorName: true,
  city: true,
  isVerifiedPurchase: true,
  isFeatured: true,
  helpfulCount: true,
  rejectionReason: true,
  moderatedAt: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  product: { select: { id: true, name: true, slug: true } },
  customer: { select: { id: true, name: true, phone: true } },
  orderItem: { select: { order: { select: { number: true } } } },
  moderatedBy: { select: { id: true, name: true } },
  repliedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

type AdminReviewRow = Prisma.ReviewGetPayload<{ select: typeof adminReviewSelect }>;

const toAdminReview = ({ orderItem, ...row }: AdminReviewRow) => ({
  ...row,
  orderNumber: orderItem?.order.number ?? null,
});

/**
 * Review moderation. Only APPROVED reviews are public; product ratings follow automatically
 * (database trigger). Every decision is audited and refreshes the review and catalog caches
 * (ratings appear on product cards).
 */
@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reviews: ReviewsService,
    private readonly catalog: CatalogService,
  ) {}

  async list(query: AdminReviewsQuery) {
    const where: Prisma.ReviewWhereInput = {
      status: query.status,
      rating: query.rating,
      productId: query.product,
      isFeatured: query.featured,
      id: query.before ? { lt: query.before } : undefined,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { body: { contains: query.q, mode: 'insensitive' } },
              { authorName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.review.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: adminReviewSelect,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toAdminReview),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async counts() {
    const groups = await this.prisma.review.groupBy({ by: ['status'], _count: { _all: true } });
    return Object.fromEntries(
      reviewStatuses.map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0]),
    );
  }

  async get(id: string) {
    const row = await this.prisma.review.findUnique({ where: { id }, select: adminReviewSelect });
    if (!row) throw reviewNotFound();
    return toAdminReview(row);
  }

  approve(id: string, actor: AuditActor) {
    return this.change(id, actor, 'review.approve', (before) => {
      if (before.status === 'APPROVED')
        throw conflict('ALREADY_APPROVED', 'This review is already published.');
      return { status: 'APPROVED', rejectionReason: null };
    });
  }

  reject(id: string, reason: string, actor: AuditActor) {
    return this.change(id, actor, 'review.reject', (before) => {
      if (before.status === 'REJECTED')
        throw conflict('ALREADY_REJECTED', 'This review is already rejected.');
      return { status: 'REJECTED', rejectionReason: reason, isFeatured: false };
    });
  }

  feature(id: string, featured: boolean, actor: AuditActor) {
    return this.change(id, actor, featured ? 'review.feature' : 'review.unfeature', (before) => {
      if (featured && before.status !== 'APPROVED') {
        throw conflict('NOT_APPROVED', 'Only published reviews can be featured.');
      }
      return { isFeatured: featured };
    });
  }

  reply(id: string, reply: string | null | undefined, actor: AuditActor) {
    return this.change(id, actor, reply ? 'review.reply' : 'review.reply.remove', () =>
      reply
        ? { reply, repliedAt: new Date(), repliedBy: { connect: { id: actor.staffId ?? '' } } }
        : { reply: null, repliedAt: null, repliedBy: { disconnect: true } },
    );
  }

  /** Permanently removes a review (spam). Prefer rejecting: it keeps the record. */
  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, 'reviews', id))) throw reviewNotFound();
      const row = await tx.review.findUniqueOrThrow({
        where: { id },
        select: {
          productId: true,
          authorName: true,
          rating: true,
          title: true,
          body: true,
          status: true,
        },
      });
      await tx.review.delete({ where: { id } });
      await this.audit.record(
        actor,
        { action: 'review.delete', entityType: 'review', entityId: id, changes: row },
        tx,
      );
    });
    await this.refreshCaches();
  }

  private async change(
    id: string,
    actor: AuditActor,
    action: string,
    decide: (before: { status: string; isFeatured: boolean }) => Prisma.ReviewUpdateInput,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await lockRow(tx, 'reviews', id))) throw reviewNotFound();
        const before = await tx.review.findUniqueOrThrow({
          where: { id },
          select: { status: true, isFeatured: true, reply: true, rejectionReason: true },
        });
        const data = decide(before);
        const moderation = 'status' in data || 'isFeatured' in data;
        await tx.review.update({
          where: { id },
          data: {
            ...data,
            ...(moderation
              ? {
                  moderatedAt: new Date(),
                  moderatedBy: actor.staffId ? { connect: { id: actor.staffId } } : undefined,
                }
              : {}),
          },
        });
        const { repliedBy: _r, repliedAt: _a, ...logged } = data;
        await this.audit.record(
          actor,
          { action, entityType: 'review', entityId: id, changes: { before, after: logged } },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict(
          'DUPLICATE_REVIEW',
          'This customer already has a published or pending review of this product.',
        );
      }
      throw error;
    }
    await this.refreshCaches();
    return this.get(id);
  }

  private async refreshCaches() {
    await this.reviews.invalidate();
    await this.catalog.invalidate();
  }
}
