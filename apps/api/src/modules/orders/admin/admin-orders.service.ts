import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { DomainException } from '../../../common/http/problem-details.js';
import { normalizePkMobile } from '../../../common/phone.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../../storage/object-storage.js';
import { type AuditActor, AuditService } from '../../audit/audit.service.js';
import { CatalogService } from '../../catalog/catalog.service.js';
import { normalizeOrderNumber } from '../order-number.js';
import { commitSale, releaseDiscount, releaseReservation, restock } from '../stock.js';
import {
  type AdminOrderDto,
  adminOrderListSelect,
  adminOrderSelect,
  toAdminOrderDto,
  toAdminOrderListItem,
} from './admin-order.mapper.js';
import type { AdminOrdersQuery } from './admin-orders.schemas.js';
import { canReviewPayment, checkTransition, type StaffAction, TO } from './order-workflow.js';

type Tx = Prisma.TransactionClient;

/** Signed screenshot URLs live this long (enough to look, too short to share around). */
export const PROOF_URL_TTL_SECONDS = 300;

/** Pakistan time: date filters ("orders on 20 Nov") mean the store's calendar day. */
const STORE_UTC_OFFSET = '+05:00';

export type TransitionInput =
  | { action: 'confirm' | 'process' | 'deliver'; note?: string }
  | { action: 'ship'; courier: string; trackingNumber?: string; note?: string }
  | {
      action: 'cancel';
      reason: string;
      customerMessage?: string;
      /** Jobs: skip if a payment arrived after the order was picked (checked under the lock). */
      onlyIfUnpaid?: boolean;
    }
  | { action: 'return'; restock: boolean; note?: string }
  | { action: 'refund'; reference?: string; note?: string };

/** What the customer sees on their timeline for each step. */
const CUSTOMER_MESSAGE: Record<StaffAction, string> = {
  confirm: 'Your order is confirmed.',
  process: 'We are packing your order.',
  ship: 'Your order is on its way.',
  deliver: 'Delivered — thank you for shopping with us!',
  cancel: 'This order was cancelled. Contact us if you have any questions.',
  return: 'Your return has been received.',
  refund: 'Your refund has been sent.',
};

const notFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');

/**
 * Staff side of orders: search, the fulfilment workflow, payment-proof review and notes.
 * Every change locks the order row, re-checks the state machine, writes timeline events and an
 * audit entry in the same transaction.
 */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  // ─── Reads ───

  async list(query: AdminOrdersQuery) {
    const where: Prisma.OrderWhereInput = {
      status: query.status?.length ? { in: query.status } : undefined,
      paymentStatus: query.paymentStatus?.length ? { in: query.paymentStatus } : undefined,
      paymentMethod: query.paymentMethod?.length ? { in: query.paymentMethod } : undefined,
      placedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(`${query.from}T00:00:00${STORE_UTC_OFFSET}`) : undefined,
              lte: query.to ? new Date(`${query.to}T23:59:59.999${STORE_UTC_OFFSET}`) : undefined,
            }
          : undefined,
      ...(query.q ? searchWhere(query.q) : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminOrderListSelect,
      }),
    ]);
    return {
      items: rows.map(toAdminOrderListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  /** Badge counts for the admin navigation. */
  async counts() {
    const [byStatus, awaitingPaymentReview] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.count({ where: { paymentStatus: 'AWAITING_VERIFICATION' } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])) as Partial<
      Record<string, number>
    >;
    return {
      byStatus: counts,
      awaitingPaymentReview,
      toConfirm: counts.PENDING ?? 0,
      toShip: (counts.CONFIRMED ?? 0) + (counts.PROCESSING ?? 0),
    };
  }

  async get(rawNumber: string): Promise<AdminOrderDto> {
    const number = normalizeOrderNumber(rawNumber);
    if (!number) throw notFound();
    const row = await this.prisma.order.findUnique({ where: { number }, select: adminOrderSelect });
    if (!row) throw notFound();
    return toAdminOrderDto(row);
  }

  // ─── Workflow ───

  async transition(number: string, input: TransitionInput, actor: AuditActor) {
    const id = await this.idOf(number);
    return this.transitionById(id, input, actor);
  }

  /** Also used by the auto-cancel job (actor without a staff id = SYSTEM). */
  async transitionById(
    id: string,
    input: TransitionInput,
    actor: AuditActor,
  ): Promise<AdminOrderDto> {
    const { action } = input;
    const row = await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      const check = checkTransition(order, action);
      if (!check.allowed) throw new DomainException(HttpStatus.CONFLICT, check.code, check.detail);

      const now = new Date();
      const data: Prisma.OrderUpdateInput = {};
      let customerNote =
        input.action === 'cancel' && input.customerMessage
          ? input.customerMessage
          : CUSTOMER_MESSAGE[action];
      const internal: string[] = [];

      switch (input.action) {
        case 'confirm':
          data.confirmedAt = now;
          break;
        case 'process':
          break;
        case 'ship':
          await commitSale(tx, order.items, order.number, actor.staffId);
          data.shippedAt = now;
          data.courier = input.courier;
          data.trackingNumber = input.trackingNumber ?? null;
          customerNote = `Shipped with ${input.courier}${
            input.trackingNumber ? ` — tracking number ${input.trackingNumber}` : ''
          }.`;
          break;
        case 'deliver':
          data.deliveredAt = now;
          // Cash on delivery: the courier collected the money.
          if (order.paymentMethod === 'COD') data.paymentStatus = 'PAID';
          break;
        case 'cancel':
          if (
            input.onlyIfUnpaid &&
            order.paymentStatus !== 'UNPAID' &&
            order.paymentStatus !== 'FAILED'
          ) {
            throw new DomainException(
              HttpStatus.CONFLICT,
              'PAYMENT_IN_PROGRESS',
              'A payment was submitted for this order; it was not cancelled.',
            );
          }
          await releaseReservation(tx, order.items);
          await releaseDiscount(tx, order.discountId);
          data.cancelledAt = now;
          internal.push(`Cancellation reason: ${input.reason}`);
          break;
        case 'return':
          if (input.restock) await restock(tx, order.items, order.number, actor.staffId);
          internal.push(input.restock ? 'Items restocked.' : 'Items not restocked (damaged).');
          break;
        case 'refund':
          data.paymentStatus = 'REFUNDED';
          if (input.reference) internal.push(`Refund reference: ${input.reference}`);
          break;
      }
      if (input.action !== 'cancel' && input.note) internal.push(input.note);
      if (action !== 'refund') data.status = TO[action];

      const actorType = actor.staffId ? ('STAFF' as const) : ('SYSTEM' as const);
      const newStatus = action === 'refund' ? null : TO[action];
      await tx.order.update({
        where: { id },
        data: {
          ...data,
          events: {
            create: [
              {
                type: `order.${action}`,
                status: newStatus,
                note: customerNote,
                actorType,
                actorStaffId: actor.staffId,
              },
              ...internal.map((note) => ({
                type: 'note',
                note,
                isCustomerVisible: false,
                actorType,
                actorStaffId: actor.staffId,
              })),
            ],
          },
        },
      });
      await this.audit.record(
        actor,
        {
          action: `order.${action}`,
          entityType: 'order',
          entityId: id,
          changes: {
            number: order.number,
            before: { status: order.status, paymentStatus: order.paymentStatus },
            after: {
              status: newStatus ?? order.status,
              paymentStatus: data.paymentStatus ?? order.paymentStatus,
            },
            input,
          },
        },
        tx,
      );
      return tx.order.findUniqueOrThrow({ where: { id }, select: adminOrderSelect });
    });
    // Released or restocked units change availability on the storefront.
    if (action === 'cancel' || (input.action === 'return' && input.restock)) {
      await this.catalog.invalidate();
    }
    return toAdminOrderDto(row);
  }

  async addNote(
    number: string,
    note: string,
    customerVisible: boolean,
    actor: AuditActor,
  ): Promise<AdminOrderDto> {
    const id = await this.idOf(number);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, id);
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: 'note',
          note,
          isCustomerVisible: customerVisible,
          actorType: 'STAFF',
          actorStaffId: actor.staffId,
        },
      });
      await this.audit.record(
        actor,
        { action: 'order.note', entityType: 'order', entityId: id, changes: { customerVisible } },
        tx,
      );
      return tx.order.findUniqueOrThrow({ where: { id }, select: adminOrderSelect });
    });
    return toAdminOrderDto(row);
  }

  // ─── Payment proofs ───

  /** Short-lived link to the screenshot; every view is audited (it is personal data). */
  async proofUrl(number: string, proofId: string, actor: AuditActor) {
    const id = await this.idOf(number);
    const proof = await this.prisma.paymentProof.findFirst({
      where: { id: proofId, orderId: id },
      select: { media: { select: { storageKey: true, mimeType: true } } },
    });
    if (!proof) throw proofNotFound();
    const url = await this.storage.signedPrivateUrl(proof.media.storageKey, {
      expiresInSeconds: PROOF_URL_TTL_SECONDS,
      contentType: proof.media.mimeType,
    });
    await this.audit.record(actor, {
      action: 'payment.proof.view',
      entityType: 'order',
      entityId: id,
      changes: { proofId },
    });
    return {
      url,
      expiresAt: new Date(Date.now() + PROOF_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** Marks the payment received; a pending order is confirmed at the same time. */
  async acceptProof(number: string, proofId: string, note: string | undefined, actor: AuditActor) {
    const id = await this.idOf(number);
    const row = await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      await this.pendingProof(tx, id, proofId);
      if (!canReviewPayment(order)) throw reviewClosed();

      const now = new Date();
      await tx.paymentProof.update({
        where: { id: proofId },
        data: { status: 'ACCEPTED', reviewedAt: now, reviewedByStaffId: actor.staffId, note },
      });
      // Duplicate uploads for the same payment need no separate review.
      await tx.paymentProof.updateMany({
        where: { orderId: id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedAt: now,
          reviewedByStaffId: actor.staffId,
          note: 'Another screenshot for this order was accepted.',
        },
      });
      const confirm = order.status === 'PENDING';
      await tx.order.update({
        where: { id },
        data: {
          paymentStatus: 'PAID',
          ...(confirm ? { status: 'CONFIRMED', confirmedAt: now } : {}),
          events: {
            create: [
              {
                type: 'payment.accepted',
                note: 'Payment received — thank you!',
                actorType: 'STAFF',
                actorStaffId: actor.staffId,
              },
              ...(confirm
                ? [
                    {
                      type: 'order.confirm',
                      status: 'CONFIRMED' as const,
                      note: CUSTOMER_MESSAGE.confirm,
                      actorType: 'STAFF' as const,
                      actorStaffId: actor.staffId,
                    },
                  ]
                : []),
            ],
          },
        },
      });
      await this.audit.record(
        actor,
        {
          action: 'payment.proof.accept',
          entityType: 'order',
          entityId: id,
          changes: { proofId, confirmed: confirm, note: note ?? null },
        },
        tx,
      );
      return tx.order.findUniqueOrThrow({ where: { id }, select: adminOrderSelect });
    });
    return toAdminOrderDto(row);
  }

  /** The customer sees the reason and can upload a new screenshot. */
  async rejectProof(number: string, proofId: string, reason: string, actor: AuditActor) {
    const id = await this.idOf(number);
    const row = await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      await this.pendingProof(tx, id, proofId);
      if (!canReviewPayment(order)) throw reviewClosed();

      await tx.paymentProof.update({
        where: { id: proofId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedByStaffId: actor.staffId,
          note: reason,
        },
      });
      const stillPending = await tx.paymentProof.count({
        where: { orderId: id, status: 'PENDING' },
      });
      await tx.order.update({
        where: { id },
        data: {
          ...(stillPending === 0 ? { paymentStatus: 'FAILED' as const } : {}),
          events: {
            create: {
              type: 'payment.rejected',
              note: `We could not verify your payment screenshot: ${withFullStop(reason)} Please upload a new one or contact us.`,
              actorType: 'STAFF',
              actorStaffId: actor.staffId,
            },
          },
        },
      });
      await this.audit.record(
        actor,
        {
          action: 'payment.proof.reject',
          entityType: 'order',
          entityId: id,
          changes: { proofId, reason },
        },
        tx,
      );
      return tx.order.findUniqueOrThrow({ where: { id }, select: adminOrderSelect });
    });
    return toAdminOrderDto(row);
  }

  // ─── Internals ───

  private async idOf(rawNumber: string): Promise<string> {
    const number = normalizeOrderNumber(rawNumber);
    if (!number) throw notFound();
    const order = await this.prisma.order.findUnique({ where: { number }, select: { id: true } });
    if (!order) throw notFound();
    return order.id;
  }

  /** Row lock: concurrent staff actions, customer cancels and jobs apply one at a time. */
  private async lockOrder(tx: Tx, id: string) {
    await tx.$executeRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.order.findUniqueOrThrow({
      where: { id },
      select: {
        number: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        discountId: true,
        items: { select: { variantId: true, quantity: true } },
      },
    });
  }

  private async pendingProof(tx: Tx, orderId: string, proofId: string) {
    const proof = await tx.paymentProof.findFirst({
      where: { id: proofId, orderId },
      select: { status: true },
    });
    if (!proof) throw proofNotFound();
    if (proof.status !== 'PENDING') {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'PROOF_ALREADY_REVIEWED',
        'This screenshot has already been reviewed.',
      );
    }
  }
}

const withFullStop = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

const proofNotFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'PROOF_NOT_FOUND', 'Payment screenshot not found.');

const reviewClosed = () =>
  new DomainException(
    HttpStatus.CONFLICT,
    'PAYMENT_REVIEW_CLOSED',
    'This order is no longer waiting for a payment check.',
  );

/** Order number → exact match; phone in any spelling → exact; otherwise part of the name. */
export function searchWhere(q: string): Prisma.OrderWhereInput {
  const number = normalizeOrderNumber(q);
  if (number) return { number };
  const phone = normalizePkMobile(q);
  if (phone) return { OR: [{ phone }, { shippingPhone: phone }] };
  return { customerName: { contains: q, mode: 'insensitive' } };
}
