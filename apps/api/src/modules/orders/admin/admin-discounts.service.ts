import type { AdminDiscountDetailDto, AdminDiscountDto, AdminDiscountListDto } from '@as/contracts';
import { Injectable } from '@nestjs/common';

import { assertFresh, conflict, lockRow, notFound } from '../../../common/admin-write.js';
import {
  type FieldError,
  ValidationFailedException,
} from '../../../common/http/problem-details.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import {
  checkDiscountShape,
  type CreateDiscountInput,
  type discountStates,
  type ListDiscountsQuery,
  type UpdateDiscountInput,
} from './admin-discounts.schemas.js';

type DiscountState = (typeof discountStates)[number];

const discountNotFound = () => notFound('DISCOUNT_NOT_FOUND', 'Discount not found.');
const codeTaken = () => conflict('CODE_TAKEN', 'Another discount already uses that code.');

const discountSelect = {
  id: true,
  code: true,
  description: true,
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiscountSelect;

type DiscountRow = Prisma.DiscountGetPayload<{ select: typeof discountSelect }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Dates as ISO strings for the response. */
const toDto = (d: DiscountRow, state: DiscountState): AdminDiscountDto => ({
  ...d,
  startsAt: iso(d.startsAt),
  endsAt: iso(d.endsAt),
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
  state,
});

/** What checkout would do with the code right now (same rules as `evaluateDiscount`). */
export function discountState(d: DiscountRow, now: Date): DiscountState {
  if (!d.isActive) return 'inactive';
  if (d.endsAt && d.endsAt <= now) return 'expired';
  if (d.usageLimit !== null && d.usageCount >= d.usageLimit) return 'used-up';
  if (d.startsAt && d.startsAt > now) return 'scheduled';
  return 'active';
}

function stateWhere(
  state: DiscountState,
  now: Date,
  usageLimit: Prisma.IntFieldRefInput<'Discount'>,
): Prisma.DiscountWhereInput {
  const notExpired = { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  const started = { OR: [{ startsAt: null }, { startsAt: { lte: now } }] };
  const usesLeft = { OR: [{ usageLimit: null }, { usageCount: { lt: usageLimit } }] };
  switch (state) {
    case 'inactive':
      return { isActive: false };
    case 'expired':
      return { isActive: true, endsAt: { lte: now } };
    case 'used-up':
      return { isActive: true, AND: [notExpired], usageCount: { gte: usageLimit } };
    case 'scheduled':
      return { isActive: true, startsAt: { gt: now }, AND: [notExpired, usesLeft] };
    case 'active':
      return { isActive: true, AND: [notExpired, usesLeft, started] };
  }
}

/**
 * Discount codes. Orders keep their own snapshot of the amount taken off, so editing a code
 * changes only future checkouts; a code that has been used keeps its code and is deactivated
 * rather than deleted (orders reference it).
 */
@Injectable()
export class AdminDiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListDiscountsQuery): Promise<AdminDiscountListDto> {
    const now = new Date();
    const where: Prisma.DiscountWhereInput = {
      ...(query.q ? { code: { startsWith: query.q, mode: 'insensitive' } } : {}),
      ...(query.state ? stateWhere(query.state, now, this.prisma.discount.fields.usageLimit) : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.discount.count({ where }),
      this.prisma.discount.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: discountSelect,
      }),
    ]);
    return {
      items: rows.map((d) => toDto(d, discountState(d, now))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string): Promise<AdminDiscountDetailDto> {
    const row = await this.prisma.discount.findUnique({ where: { id }, select: discountSelect });
    if (!row) throw discountNotFound();
    const stats = await this.prisma.order.aggregate({
      where: { discountId: id, status: { notIn: ['CANCELLED'] } },
      _count: { _all: true },
      _sum: { discountMinor: true, totalMinor: true },
    });
    return {
      ...toDto(row, discountState(row, new Date())),
      stats: {
        /** Orders (not cancelled) that used the code. */
        orders: stats._count._all,
        discountGivenMinor: stats._sum.discountMinor ?? 0,
        revenueMinor: stats._sum.totalMinor ?? 0,
      },
    };
  }

  async create(input: CreateDiscountInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      if (await tx.discount.findUnique({ where: { code: input.code }, select: { id: true } })) {
        throw codeTaken();
      }
      const created = await tx.discount.create({
        data: { ...input, description: input.description ?? null },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'discount.create',
          entityType: 'discount',
          entityId: created.id,
          changes: { ...input },
        },
        tx,
      );
      return created.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateDiscountInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'discounts', id))) throw discountNotFound();
      const before = await tx.discount.findUniqueOrThrow({ where: { id }, select: discountSelect });
      assertFresh(before.updatedAt, input.updatedAt, 'discount');
      const { updatedAt: _ignored, ...fields } = input;
      const merged = { ...before, ...fields };

      const errors: FieldError[] = [];
      checkDiscountShape(merged, {
        addIssue: (issue) => errors.push({ path: issue.path.join('.'), message: issue.message }),
      });
      if (fields.code && fields.code !== before.code && before.usageCount > 0) {
        errors.push({
          path: 'code',
          message: 'Customers have used this code, so it cannot be renamed. Create a new one.',
        });
      }
      if (merged.usageLimit !== null && merged.usageLimit < before.usageCount) {
        errors.push({
          path: 'usageLimit',
          message: `It has already been used ${String(before.usageCount)} times.`,
        });
      }
      if (errors.length) throw new ValidationFailedException(errors);
      if (fields.code && fields.code !== before.code) {
        const taken = await tx.discount.findUnique({
          where: { code: fields.code },
          select: { id: true },
        });
        if (taken) throw codeTaken();
      }

      await tx.discount.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
      await this.audit.record(
        actor,
        {
          action: 'discount.update',
          entityType: 'discount',
          entityId: id,
          changes: { code: before.code, ...diff(before, fields) },
        },
        tx,
      );
    });
    return this.get(id);
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'discounts', id))) throw discountNotFound();
      const row = await tx.discount.findUniqueOrThrow({
        where: { id },
        select: { code: true, _count: { select: { orders: true } } },
      });
      if (row._count.orders > 0) {
        throw conflict(
          'DISCOUNT_IN_USE',
          'Orders used this code, so it is kept for their records. Deactivate it instead.',
          { orders: row._count.orders },
        );
      }
      await tx.discount.delete({ where: { id } });
      await this.audit.record(
        actor,
        {
          action: 'discount.delete',
          entityType: 'discount',
          entityId: id,
          changes: { code: row.code },
        },
        tx,
      );
    });
  }

  private async write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (isUniqueViolation(error, 'code')) throw codeTaken();
      throw error;
    }
  }
}
