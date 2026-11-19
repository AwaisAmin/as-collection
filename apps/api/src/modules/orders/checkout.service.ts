import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { hmacHex, safeEqualHex, sha256Hex } from '../../common/crypto.js';
import { DomainException, type JsonValue } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { stableStringify } from '../../redis/cache.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { PlaceOrderBody, QuoteBody } from './checkout.schemas.js';
import { orderDetailSelect, type OrderDto, toOrderDto } from './order.mapper.js';
import { generateOrderNumber } from './order-number.js';
import {
  buildQuote,
  type CartLineInput,
  type DiscountRule,
  normalizeLines,
  type PricedVariant,
  type Quote,
} from './pricing.js';
import { StoreSettingsService } from './store-settings.service.js';
import { pricedVariantSelect, toPricedVariant } from './variant-pricing.js';

type Tx = Prisma.TransactionClient;

export interface PlacedOrder {
  order: OrderDto;
  /** Secret for the confirmation link / guest access. Never stored, only its hash. */
  accessKey: string;
  /** True when this was a retry of an already placed checkout. */
  replayed: boolean;
}

/** Signals a rollback whose response needs a fresh quote (computed after the rollback). */
class StockChangedError extends Error {}

const discountSelect = {
  id: true,
  code: true,
  type: true,
  value: true,
  minSubtotalMinor: true,
  maxDiscountMinor: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  usageCount: true,
  perCustomerLimit: true,
  isActive: true,
} satisfies Prisma.DiscountSelect;

const isUniqueViolation = (error: unknown, field: string) =>
  error instanceof Error &&
  error.name === 'PrismaClientKnownRequestError' &&
  (error as Error & { code?: string }).code === 'P2002' &&
  JSON.stringify((error as Error & { meta?: unknown }).meta ?? '').includes(field);

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as JsonValue;

/**
 * Checkout: quotes and order placement.
 *
 * Placing an order is one transaction: re-price from the database, reserve stock with conditional
 * updates (`on_hand - reserved >= qty`, so concurrent checkouts can never oversell), claim the
 * coupon atomically, and write the order with snapshotted prices, names and address. Retries with
 * the same Idempotency-Key return the original order; reusing a key for a different cart is
 * rejected.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger('Checkout');
  private readonly secret: string;
  private readonly mediaBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
    private readonly catalog: CatalogService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
    this.mediaBaseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  /** Access key for an order: derived (HMAC), so a retried checkout can return it again. */
  accessKeyFor(orderNumber: string): string {
    return hmacHex(this.secret, `order-access:${orderNumber}`).slice(0, 32);
  }

  verifyAccessKey(accessKeyHash: string, candidate: string): boolean {
    return /^[0-9a-f]{32}$/.test(candidate) && safeEqualHex(accessKeyHash, sha256Hex(candidate));
  }

  async quote(body: QuoteBody, phone?: string): Promise<Quote> {
    const now = new Date();
    return this.priceCart(this.prisma, body.lines, body.discountCode, now, phone);
  }

  async placeOrder(
    body: PlaceOrderBody,
    idempotencyKey: string,
    customerId: string | null,
  ): Promise<PlacedOrder> {
    const requestHash = sha256Hex(stableStringify({ body, customerId }));

    const existing = await this.findByIdempotencyKey(idempotencyKey, requestHash);
    if (existing) return existing;

    const now = new Date();
    const lines = normalizeLines(body.lines);
    try {
      const placed = await this.prisma.$transaction(
        (tx) =>
          this.placeInTransaction(tx, body, lines, {
            idempotencyKey,
            requestHash,
            customerId,
            now,
          }),
        { maxWait: 5_000, timeout: 15_000 },
      );
      if (placed.soldOut) await this.catalog.invalidate();
      return placed.result;
    } catch (error) {
      if (error instanceof StockChangedError) {
        const fresh = await this.priceCart(
          this.prisma,
          lines,
          body.discountCode,
          now,
          body.customer.phone,
        );
        throw this.cartChanged(
          'OUT_OF_STOCK',
          'Some items are no longer available in that quantity.',
          fresh,
        );
      }
      // A concurrent retry with the same key won the race: return its order.
      if (isUniqueViolation(error, 'idempotency_key')) {
        const winner = await this.findByIdempotencyKey(idempotencyKey, requestHash);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private async placeInTransaction(
    tx: Tx,
    body: PlaceOrderBody,
    lines: CartLineInput[],
    ctx: { idempotencyKey: string; requestHash: string; customerId: string | null; now: Date },
  ): Promise<{ result: PlacedOrder; soldOut: boolean }> {
    const quote = await this.priceCart(tx, lines, body.discountCode, ctx.now, body.customer.phone);

    if (!quote.purchasable) {
      throw this.cartChanged(
        'OUT_OF_STOCK',
        'Some items are no longer available in that quantity.',
        quote,
      );
    }
    if (body.discountCode && !quote.discount?.applied) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'DISCOUNT_INVALID',
        'This coupon cannot be used.',
        {
          extensions: { quote: toJson(quote) },
        },
      );
    }
    if (quote.totalMinor !== body.expectedTotalMinor) {
      throw this.cartChanged(
        'PRICE_CHANGED',
        'Prices changed since you last saw your cart.',
        quote,
      );
    }

    // Reserve stock in a fixed order (by variant id) so concurrent checkouts cannot deadlock.
    let soldOut = false;
    for (const line of [...quote.lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const rows = await tx.$queryRaw<{ available: number; tracked: boolean }[]>`
        UPDATE inventory_items
        SET reserved = reserved + ${line.quantity}, version = version + 1, updated_at = now()
        WHERE variant_id = ${line.variantId}::uuid
          AND (NOT track_inventory OR allow_backorder OR on_hand - reserved >= ${line.quantity})
        RETURNING (on_hand - reserved)::int AS available, track_inventory AS tracked`;
      const row = rows[0];
      if (!row) throw new StockChangedError();
      if (row.tracked && row.available <= 0) soldOut = true;
    }

    // Claim one coupon use atomically (the usage limit holds under concurrency).
    let discountId: string | null = null;
    if (quote.discount?.applied) {
      const discount = await tx.discount.findUniqueOrThrow({
        where: { code: quote.discount.code },
        select: { id: true },
      });
      const claimed = await tx.$executeRaw`
        UPDATE discounts SET usage_count = usage_count + 1, updated_at = now()
        WHERE id = ${discount.id}::uuid AND (usage_limit IS NULL OR usage_count < usage_limit)`;
      if (claimed === 0) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'DISCOUNT_INVALID',
          'This coupon has run out.',
        );
      }
      discountId = discount.id;
    }

    const customerId =
      ctx.customerId ??
      (
        await tx.customer.findFirst({
          where: { phone: body.customer.phone, phoneVerifiedAt: { not: null }, status: 'ACTIVE' },
          select: { id: true },
        })
      )?.id ??
      null;

    const number = await this.uniqueOrderNumber(tx, ctx.now);
    const accessKey = this.accessKeyFor(number);
    const order = await tx.order.create({
      data: {
        number,
        accessKeyHash: sha256Hex(accessKey),
        idempotencyKey: ctx.idempotencyKey,
        requestHash: ctx.requestHash,
        customerId,
        paymentMethod: body.paymentMethod,
        customerName: body.customer.fullName,
        phone: body.customer.phone,
        email: body.customer.email,
        shippingName: body.shipping.fullName ?? body.customer.fullName,
        shippingPhone: body.shipping.phone ?? body.customer.phone,
        shippingLine1: body.shipping.line1,
        shippingLine2: body.shipping.line2,
        shippingCity: body.shipping.city,
        shippingProvince: body.shipping.province,
        shippingPostalCode: body.shipping.postalCode,
        notes: body.notes,
        subtotalMinor: quote.subtotalMinor,
        discountMinor: quote.discountMinor,
        shippingMinor: quote.shippingMinor,
        totalMinor: quote.totalMinor,
        discountId,
        discountCode: quote.discount?.applied ? quote.discount.code : null,
        placedAt: ctx.now,
        items: {
          create: quote.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName ?? '',
            variantTitle: line.variantTitle,
            sku: line.sku ?? '',
            imageUrl: line.image?.url ?? null,
            unitPriceMinor: line.unitPriceMinor,
            compareAtPriceMinor: line.compareAtPriceMinor,
            quantity: line.quantity,
            lineTotalMinor: line.lineTotalMinor,
          })),
        },
        events: {
          create: {
            type: 'order.placed',
            status: 'PENDING',
            actorType: 'CUSTOMER',
            note:
              body.paymentMethod === 'COD'
                ? 'Order placed. Pay cash on delivery.'
                : 'Order placed. Upload your payment screenshot to confirm it.',
          },
        },
      },
      select: orderDetailSelect,
    });

    this.logger.log(`Order ${number} placed`, {
      orderNumber: number,
      totalMinor: quote.totalMinor,
    });
    return { result: { order: toOrderDto(order), accessKey, replayed: false }, soldOut };
  }

  private async findByIdempotencyKey(
    key: string,
    requestHash: string,
  ): Promise<PlacedOrder | null> {
    const order = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      select: { ...orderDetailSelect, requestHash: true },
    });
    if (!order) return null;
    if (order.requestHash !== requestHash) {
      throw new DomainException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'IDEMPOTENCY_KEY_REUSED',
        'This checkout was already submitted with different details. Start a new checkout.',
      );
    }
    return { order: toOrderDto(order), accessKey: this.accessKeyFor(order.number), replayed: true };
  }

  private async uniqueOrderNumber(tx: Tx, now: Date): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const number = generateOrderNumber(now);
      if ((await tx.order.count({ where: { number } })) === 0) return number;
    }
    throw new Error('Could not allocate a unique order number');
  }

  private async priceCart(
    db: Tx,
    lines: readonly CartLineInput[],
    discountCode: string | undefined,
    now: Date,
    phone?: string,
  ): Promise<Quote> {
    const normalized = normalizeLines(lines);
    const [rows, shipping, rule] = await Promise.all([
      db.productVariant.findMany({
        where: { id: { in: normalized.map((l) => l.variantId) } },
        select: pricedVariantSelect,
      }),
      this.settings.shipping(),
      discountCode
        ? db.discount.findUnique({ where: { code: discountCode }, select: discountSelect })
        : Promise.resolve(null),
    ]);
    const variants = new Map<string, PricedVariant>(
      rows.map((row) => [row.id, toPricedVariant(row, this.mediaBaseUrl, now)]),
    );

    let discountRule: DiscountRule | null = rule;
    if (rule?.perCustomerLimit && phone) {
      const used = await db.order.count({
        where: { discountId: rule.id, phone, status: { not: 'CANCELLED' } },
      });
      // Treat the per-customer limit like an exhausted coupon for this shopper.
      if (used >= rule.perCustomerLimit) discountRule = { ...rule, usageLimit: 0 };
    }

    return buildQuote({
      lines: normalized,
      variants,
      shipping,
      discount: discountCode ? { code: discountCode, rule: discountRule } : undefined,
      now,
    });
  }

  private cartChanged(code: 'OUT_OF_STOCK' | 'PRICE_CHANGED', detail: string, quote: Quote) {
    return new DomainException(HttpStatus.CONFLICT, code, detail, {
      extensions: { quote: toJson(quote) },
    });
  }
}
