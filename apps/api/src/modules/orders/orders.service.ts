import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { sha256Hex } from '../../common/crypto.js';
import { detectImageType, UPLOAD_IMAGE_TYPES } from '../../common/files/image-signature.js';
import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../storage/object-storage.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { PaymentProofFields } from './checkout.schemas.js';
import { CheckoutService } from './checkout.service.js';
import {
  canCancel,
  canUploadPaymentProof,
  orderDetailSelect,
  type OrderDto,
  orderSummarySelect,
  toOrderDto,
  toOrderSummary,
  toTrackingDto,
} from './order.mapper.js';
import { normalizeOrderNumber } from './order-number.js';

/** How a caller proves the order is theirs: the confirmation-link key, or their session. */
export interface OrderAccess {
  accessKey?: string | null;
  customerId?: string | null;
}

const notFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'We could not find that order.');

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly catalog: CatalogService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /**
   * The order if the caller may see it. Unknown number, wrong key and someone else's order all
   * answer the same 404, so order numbers cannot be probed.
   */
  private async authorize(rawNumber: string, access: OrderAccess) {
    const number = normalizeOrderNumber(rawNumber);
    if (!number) throw notFound();
    const order = await this.prisma.order.findUnique({
      where: { number },
      select: { id: true, number: true, customerId: true, accessKeyHash: true },
    });
    if (!order) throw notFound();
    const byKey =
      typeof access.accessKey === 'string' &&
      this.checkout.verifyAccessKey(order.accessKeyHash, access.accessKey);
    const byOwner = access.customerId != null && order.customerId === access.customerId;
    if (!byKey && !byOwner) throw notFound();
    return order;
  }

  async get(rawNumber: string, access: OrderAccess): Promise<OrderDto> {
    const { id } = await this.authorize(rawNumber, access);
    const row = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      select: orderDetailSelect,
    });
    return toOrderDto(row);
  }

  /** Public tracking by order number + the phone used at checkout (limited view). */
  async track(rawNumber: string, phone: string) {
    const number = normalizeOrderNumber(rawNumber);
    if (!number) throw notFound();
    const row = await this.prisma.order.findUnique({
      where: { number },
      select: orderDetailSelect,
    });
    if (row?.phone !== phone) throw notFound();
    return toTrackingDto(row);
  }

  async listForCustomer(customerId: string, page: number, pageSize: number) {
    const where = { customerId };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: orderSummarySelect,
      }),
    ]);
    return {
      items: rows.map(toOrderSummary),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  /** Customer cancellation while nothing has been paid or processed. Releases the stock. */
  async cancel(rawNumber: string, access: OrderAccess): Promise<OrderDto> {
    const { id } = await this.authorize(rawNumber, access);
    const row = await this.prisma.$transaction(async (tx) => {
      // Lock the order: a cancel racing a staff confirmation must see the final state.
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          status: true,
          paymentStatus: true,
          discountId: true,
          items: { select: { variantId: true, quantity: true } },
        },
      });
      if (!canCancel(order)) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'ORDER_NOT_CANCELLABLE',
          'This order can no longer be cancelled online. Please contact us.',
        );
      }
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.$executeRaw`
          UPDATE inventory_items
          SET reserved = GREATEST(reserved - ${item.quantity}, 0), version = version + 1,
              updated_at = now()
          WHERE variant_id = ${item.variantId}::uuid AND track_inventory`;
      }
      if (order.discountId) {
        await tx.$executeRaw`
          UPDATE discounts SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
          WHERE id = ${order.discountId}::uuid`;
      }
      return tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          events: {
            create: {
              type: 'order.cancelled',
              status: 'CANCELLED',
              actorType: 'CUSTOMER',
              note: 'Cancelled by the customer.',
            },
          },
        },
        select: orderDetailSelect,
      });
    });
    await this.catalog.invalidate(); // released stock may bring products back in stock
    return toOrderDto(row);
  }

  /**
   * Bank / wallet transfer screenshot. Validated by content (not name or Content-Type), stored
   * in the PRIVATE bucket under a random key, and only then recorded. A failed database write
   * deletes the uploaded object again.
   */
  async uploadPaymentProof(
    rawNumber: string,
    access: OrderAccess,
    file: { buffer: Buffer; size: number } | undefined,
    fields: PaymentProofFields,
  ): Promise<OrderDto> {
    const { id } = await this.authorize(rawNumber, access);
    if (!file || file.size === 0) {
      throw new DomainException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_REQUIRED',
        'Please attach a screenshot of your payment.',
      );
    }
    if (file.size > MAX_PROOF_BYTES) {
      throw new DomainException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'FILE_TOO_LARGE',
        'The screenshot must be smaller than 5 MB.',
      );
    }
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) {
      throw new DomainException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_FILE_TYPE',
        'The screenshot must be a JPG, PNG or WEBP image.',
      );
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      select: {
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        _count: { select: { paymentProofs: true } },
      },
    });
    if (!canUploadPaymentProof({ ...order, proofCount: order._count.paymentProofs })) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'PAYMENT_PROOF_NOT_ACCEPTED',
        'This order does not need a payment screenshot right now.',
      );
    }

    const key = `payment-proofs/${id}/${randomUUID()}.${UPLOAD_IMAGE_TYPES[mimeType]}`;
    try {
      await this.storage.putPrivate({ key, body: file.buffer, contentType: mimeType });
    } catch (error) {
      this.logger.error(
        `Payment proof upload failed for order ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'UPLOAD_FAILED',
        'We could not save the screenshot. Please try again.',
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const media = await tx.media.create({
          data: {
            storageKey: key,
            visibility: 'PRIVATE',
            mimeType,
            sizeBytes: file.size,
            checksumSha256: sha256Hex(file.buffer),
          },
          select: { id: true },
        });
        await tx.paymentProof.create({
          data: {
            orderId: id,
            mediaId: media.id,
            method: order.paymentMethod,
            reference: fields.reference,
            amountMinor: fields.amountMinor ?? null,
          },
        });
        return tx.order.update({
          where: { id },
          data: {
            paymentStatus: 'AWAITING_VERIFICATION',
            events: {
              create: {
                type: 'payment.proof_uploaded',
                actorType: 'CUSTOMER',
                note: 'Payment screenshot received. We will verify it shortly.',
              },
            },
          },
          select: orderDetailSelect,
        });
      });
      return toOrderDto(row);
    } catch (error) {
      await this.storage.deletePrivate(key).catch(() => undefined);
      throw error;
    }
  }

  /** For the account page. Throws the same 404 for orders of other customers. */
  async getForCustomer(customerId: string, rawNumber: string): Promise<OrderDto> {
    return this.get(rawNumber, { customerId });
  }
}
