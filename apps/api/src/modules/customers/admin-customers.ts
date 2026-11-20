import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { assertFresh, conflict, lockRow, notFound } from '../../common/admin-write.js';
import { normalizePkMobile } from '../../common/phone.js';
import { clearableText, plainText } from '../../common/text.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { SessionService } from '../auth/session.service.js';
import { Actor, Staff } from '../staff/staff-auth.guard.js';

/*
 * Staff view of customer accounts: search, profile with order history, edits, and blocking.
 * Blocking signs the customer out everywhere at once and stops new sign-ins (the auth flows
 * refuse BLOCKED accounts); their past orders stay untouched.
 */

// ─── Schemas ───

export const customersQuerySchema = z.object({
  /** Phone (any spelling), email or part of the name. */
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
type CustomersQuery = z.infer<typeof customersQuerySchema>;

export const updateCustomerSchema = z
  .object({
    name: plainText({ min: 1, max: 120 }),
    marketingOptIn: z.boolean(),
    staffNote: clearableText({ max: 2_000, multiline: true }),
  })
  .partial()
  .extend({ updatedAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)) });

export const blockCustomerSchema = z.object({ reason: plainText({ min: 3, max: 300 }) });

// ─── Service ───

const customerNotFound = () => notFound('CUSTOMER_NOT_FOUND', 'Customer not found.');

/** Orders that count as spending (not cancelled). */
const countedOrders = { status: { notIn: ['CANCELLED' as const] } };

export function customerSearchWhere(q: string): Prisma.CustomerWhereInput {
  const phone = normalizePkMobile(q);
  if (phone) return { phone };
  if (q.includes('@')) return { email: { contains: q, mode: 'insensitive' } };
  return { name: { contains: q, mode: 'insensitive' } };
}

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: CustomersQuery) {
    const where: Prisma.CustomerWhereInput = {
      status: query.status,
      ...(query.q ? customerSearchWhere(query.q) : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          marketingOptIn: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);
    const stats = rows.length
      ? await this.prisma.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: rows.map((r) => r.id) }, ...countedOrders },
          _count: { _all: true },
          _sum: { totalMinor: true },
          _max: { createdAt: true },
        })
      : [];
    const byCustomer = new Map(stats.map((s) => [s.customerId, s]));
    return {
      items: rows.map((r) => {
        const s = byCustomer.get(r.id);
        return {
          ...r,
          orders: s?._count._all ?? 0,
          spentMinor: s?._sum.totalMinor ?? 0,
          lastOrderAt: s?._max.createdAt ?? null,
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        blockedReason: true,
        blockedAt: true,
        staffNote: true,
        marketingOptIn: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        googleSub: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            label: true,
            fullName: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            province: true,
            postalCode: true,
            isDefault: true,
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            number: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            totalMinor: true,
            createdAt: true,
          },
        },
        _count: { select: { reviews: true, orders: true } },
      },
    });
    if (!customer) throw customerNotFound();
    const [spent, activeSessions] = await Promise.all([
      this.prisma.order.aggregate({
        where: { customerId: id, ...countedOrders },
        _count: { _all: true },
        _sum: { totalMinor: true },
      }),
      this.prisma.customerSession.count({
        where: { customerId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    const { googleSub, _count, orders, ...rest } = customer;
    return {
      ...rest,
      /** Signs in with Google (the subject id itself is never shown). */
      hasGoogle: googleSub !== null,
      recentOrders: orders,
      stats: {
        orders: _count.orders,
        countedOrders: spent._count._all,
        spentMinor: spent._sum.totalMinor ?? 0,
        reviews: _count.reviews,
        activeSessions,
      },
    };
  }

  async update(id: string, input: z.infer<typeof updateCustomerSchema>, actor: AuditActor) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, 'customers', id))) throw customerNotFound();
      const before = await tx.customer.findUniqueOrThrow({
        where: { id },
        select: { name: true, marketingOptIn: true, staffNote: true, updatedAt: true },
      });
      assertFresh(before.updatedAt, input.updatedAt, 'customer');
      const { updatedAt: _ignored, ...fields } = input;
      await tx.customer.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
      await this.audit.record(
        actor,
        {
          action: 'customer.update',
          entityType: 'customer',
          entityId: id,
          changes: diff(before, fields),
        },
        tx,
      );
    });
    return this.get(id);
  }

  async block(id: string, reason: string, actor: AuditActor) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, 'customers', id))) throw customerNotFound();
      const before = await tx.customer.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (before.status === 'BLOCKED')
        throw conflict('ALREADY_BLOCKED', 'This account is already blocked.');
      await tx.customer.update({
        where: { id },
        data: { status: 'BLOCKED', blockedReason: reason, blockedAt: new Date() },
      });
      await this.audit.record(
        actor,
        { action: 'customer.block', entityType: 'customer', entityId: id, changes: { reason } },
        tx,
      );
    });
    // After commit: sign-ins already refuse the account, so no new session can appear.
    const signedOut = await this.sessions.revokeAll(id);
    return { ...(await this.get(id)), signedOutSessions: signedOut };
  }

  async unblock(id: string, actor: AuditActor) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, 'customers', id))) throw customerNotFound();
      const before = await tx.customer.findUniqueOrThrow({
        where: { id },
        select: { status: true, blockedReason: true },
      });
      if (before.status !== 'BLOCKED')
        throw conflict('NOT_BLOCKED', 'This account is not blocked.');
      await tx.customer.update({
        where: { id },
        data: { status: 'ACTIVE', blockedReason: null, blockedAt: null },
      });
      await this.audit.record(
        actor,
        {
          action: 'customer.unblock',
          entityType: 'customer',
          entityId: id,
          changes: { previousReason: before.blockedReason },
        },
        tx,
      );
    });
    return this.get(id);
  }
}

// ─── HTTP ───

const idParam = { schema: z.uuid() };

@ApiTags('Admin · Customers')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @Staff('customers.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Search customers (phone in any spelling, email or name)' })
  list(@Query({ schema: customersQuerySchema }) query: CustomersQuery) {
    return this.customers.list(query);
  }

  @Get(':id')
  @Staff('customers.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Profile, addresses, recent orders and totals' })
  get(@Param('id', idParam) id: string) {
    return this.customers.get(id);
  }

  @Patch(':id')
  @Staff('customers.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Edit name, marketing consent or the internal note (send `updatedAt`)' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateCustomerSchema }) body: z.infer<typeof updateCustomerSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.customers.update(id, body, actor);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @Staff('customers.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Block: signs them out everywhere and stops new sign-ins' })
  block(
    @Param('id', idParam) id: string,
    @Body({ schema: blockCustomerSchema }) body: z.infer<typeof blockCustomerSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.customers.block(id, body.reason, actor);
  }

  @Post(':id/unblock')
  @HttpCode(HttpStatus.OK)
  @Staff('customers.write')
  @Header('Cache-Control', 'no-store')
  unblock(@Param('id', idParam) id: string, @Actor() actor: AuditActor) {
    return this.customers.unblock(id, actor);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
})
export class CustomersModule {}
