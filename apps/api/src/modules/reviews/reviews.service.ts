import type { FeaturedReviewDto, ReviewPage } from '@as/contracts';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { ipHashOf } from '../../common/crypto.js';
import { DomainException, RateLimitedException } from '../../common/http/problem-details.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { windowRetryAfterSeconds } from '../../common/rate-window.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { CacheService } from '../../redis/cache.service.js';
import { StorefrontRevalidator } from '../../storefront/storefront-revalidator.js';
import { REVIEWS_CACHE } from '../catalog/catalog.service.js';
import { visibleProduct } from '../catalog/product-query.js';
import {
  reviewOrderBy,
  reviewSelect,
  type ReviewSummaryDto,
  summarize,
  toReviewDto,
} from './reviews.mapper.js';
import type { ListReviewsQuery, SubmitReviewBody } from './reviews.schemas.js';

/** Submissions per IP (and per signed-in customer) per day. */
export const REVIEW_LIMIT = { max: 5, windowMs: 86_400_000 } as const;

/** Testimonials quote at least this much text. */
const FEATURED_MIN_BODY = 60;

export type { FeaturedReviewDto, ReviewPage };

const notFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'This product is not available.');

/**
 * Product reviews. Only APPROVED reviews are public; submissions start PENDING and wait for
 * moderation. Product rating aggregates are maintained by a database trigger.
 */
@Injectable()
export class ReviewsService {
  private readonly secret: string;
  private readonly ttl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly storefront: StorefrontRevalidator,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
    this.ttl = config.get('CATALOG_CACHE_TTL_SECONDS', { infer: true });
  }

  /** Every public review read becomes stale at once (after moderation or product edits). */
  invalidate(): Promise<void> {
    this.storefront.revalidate('reviews');
    return this.cache.invalidate(REVIEWS_CACHE);
  }

  async list(slug: string, { sort, page, pageSize }: ListReviewsQuery): Promise<ReviewPage> {
    return this.cached(`list:${slug}:${sort}:${String(page)}:${String(pageSize)}`, async () => {
      const productId = await this.productIdOrThrow(slug);
      const where = { productId, status: 'APPROVED' as const };
      const [total, rows] = await Promise.all([
        this.prisma.review.count({ where }),
        this.prisma.review.findMany({
          where,
          orderBy: reviewOrderBy(sort),
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: reviewSelect,
        }),
      ]);
      return {
        items: rows.map(toReviewDto),
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      };
    });
  }

  async summary(slug: string): Promise<ReviewSummaryDto> {
    return this.cached(`summary:${slug}`, async () => {
      const productId = await this.productIdOrThrow(slug);
      return this.summaryWhere({ productId, status: 'APPROVED' });
    });
  }

  /** Rating summary across every visible product. */
  async storeSummary(): Promise<ReviewSummaryDto> {
    return this.cached('summary:store', () =>
      this.summaryWhere({ status: 'APPROVED', product: visibleProduct(new Date()) }),
    );
  }

  /**
   * Home testimonials: staff picks first (newest pick first), then the newest quotable five-star
   * verified reviews; at most one per product.
   */
  async featured(limit: number): Promise<FeaturedReviewDto[]> {
    return this.cached(`featured:${String(limit)}`, async () => {
      const select = { ...reviewSelect, product: { select: { name: true, slug: true } } };
      const product = visibleProduct(new Date());
      const picks = await this.prisma.review.findMany({
        where: { status: 'APPROVED', isFeatured: true, product },
        orderBy: [{ moderatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select,
      });
      const automatic = await this.prisma.review.findMany({
        where: {
          status: 'APPROVED',
          rating: 5,
          isVerifiedPurchase: true,
          isFeatured: false,
          product,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.max(50, limit * 6),
        select,
      });
      const seen = new Set<string>();
      const featured: FeaturedReviewDto[] = [];
      for (const [row, picked] of [
        ...picks.map((r) => [r, true] as const),
        ...automatic.map((r) => [r, false] as const),
      ]) {
        if (featured.length === limit) break;
        if (seen.has(row.productId) || (!picked && row.body.length < FEATURED_MIN_BODY)) continue;
        seen.add(row.productId);
        featured.push({ ...toReviewDto(row), product: row.product });
      }
      return featured;
    });
  }

  /**
   * Queues a review for moderation. Signed-in customers with a delivered order for the product
   * get "Verified purchase"; each customer has at most one live review per product.
   */
  async submit(
    slug: string,
    body: SubmitReviewBody,
    customerId: string | null,
    ip: string | null,
  ): Promise<{ id: string; status: 'PENDING' }> {
    const now = new Date();
    const product = await this.prisma.product.findFirst({
      where: { slug, ...visibleProduct(now) },
      select: { id: true },
    });
    if (!product) throw notFound();

    const ipHash = ipHashOf(this.secret, ip);
    await this.enforceLimit(now, ipHash, customerId);

    const orderItem = customerId
      ? await this.prisma.orderItem.findFirst({
          where: {
            productId: product.id,
            order: { customerId, status: 'DELIVERED' },
            review: { is: null },
          },
          orderBy: { order: { createdAt: 'desc' } },
          select: { id: true },
        })
      : null;

    try {
      const review = await this.prisma.review.create({
        data: {
          productId: product.id,
          customerId,
          orderItemId: orderItem?.id ?? null,
          isVerifiedPurchase: orderItem !== null,
          authorName: body.author,
          city: body.city ?? null,
          rating: body.rating,
          title: body.title,
          body: body.body,
          ipHash,
        },
        select: { id: true },
      });
      return { id: review.id, status: 'PENDING' };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'ALREADY_REVIEWED',
          'You have already reviewed this product.',
        );
      }
      throw error;
    }
  }

  /**
   * "Helpful" vote: once per voter (signed-in customer, else hashed IP). Idempotent — voting
   * again returns the current count.
   */
  async markHelpful(
    reviewId: string,
    customerId: string | null,
    ip: string | null,
  ): Promise<{ helpfulCount: number }> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, status: 'APPROVED', product: visibleProduct(new Date()) },
      select: { id: true, helpfulCount: true },
    });
    if (!review) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'REVIEW_NOT_FOUND', 'Review not found.');
    }
    const ipHash = ipHashOf(this.secret, ip);
    const voterKey = customerId ? `c:${customerId}` : ipHash ? `i:${ipHash.slice(0, 62)}` : null;
    if (!voterKey) return { helpfulCount: review.helpfulCount };

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.reviewVote.createMany({
        data: [{ reviewId, voterKey }],
        skipDuplicates: true,
      });
      if (count === 0) {
        const current = await tx.review.findUniqueOrThrow({
          where: { id: reviewId },
          select: { helpfulCount: true },
        });
        return { helpfulCount: current.helpfulCount };
      }
      return tx.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
        select: { helpfulCount: true },
      });
    });
  }

  // ─── Internals ───

  private async enforceLimit(now: Date, ipHash: string | null, customerId: string | null) {
    const since = new Date(now.getTime() - REVIEW_LIMIT.windowMs);
    const recent = (where: { ipHash: string } | { customerId: string }) =>
      this.prisma.review
        .findMany({
          where: { ...where, createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: REVIEW_LIMIT.max,
          select: { createdAt: true },
        })
        .then((rows) => rows.map((r) => r.createdAt));

    const [byIp, byCustomer] = await Promise.all([
      ipHash ? recent({ ipHash }) : [],
      customerId ? recent({ customerId }) : [],
    ]);
    const wait = Math.max(
      windowRetryAfterSeconds(byIp, REVIEW_LIMIT.max, REVIEW_LIMIT.windowMs, now) ?? 0,
      windowRetryAfterSeconds(byCustomer, REVIEW_LIMIT.max, REVIEW_LIMIT.windowMs, now) ?? 0,
    );
    if (wait > 0) {
      throw new RateLimitedException(
        'REVIEW_RATE_LIMITED',
        'You have submitted several reviews today. Please try again later.',
        wait,
      );
    }
  }

  private async summaryWhere(where: Prisma.ReviewWhereInput): Promise<ReviewSummaryDto> {
    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { _all: true },
    });
    return summarize(groups.map((g) => ({ rating: g.rating, count: g._count._all })));
  }

  private async productIdOrThrow(slug: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...visibleProduct(new Date()) },
      select: { id: true },
    });
    if (!product) throw notFound();
    return product.id;
  }

  private cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(REVIEWS_CACHE, key, this.ttl, loader);
  }
}
