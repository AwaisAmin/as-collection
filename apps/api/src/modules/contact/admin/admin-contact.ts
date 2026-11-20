import { Body, Controller, Get, Header, Injectable, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { lockRow, notFound } from '../../../common/admin-write.js';
import { normalizePkMobile } from '../../../common/phone.js';
import { clearableText } from '../../../common/text.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { Actor, Staff } from '../../staff/staff-auth.guard.js';

/*
 * Staff inbox for contact-form messages: filter, read, mark handled / archived, internal note.
 * Messages are personal data, so every response is `no-store`.
 */

export const contactStatuses = ['NEW', 'READ', 'ARCHIVED'] as const;
const topics = ['ORDER', 'RETURNS', 'PRODUCT', 'WHOLESALE', 'OTHER'] as const;

export const inboxQuerySchema = z.object({
  status: z.enum(contactStatuses).optional(),
  topic: z.enum(topics).optional(),
  /** Name, email, phone (any spelling), order number or words in the message. */
  q: z.string().trim().min(1).max(100).optional(),
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
type InboxQuery = z.infer<typeof inboxQuerySchema>;

export const updateMessageSchema = z
  .object({
    status: z.enum(contactStatuses),
    staffNote: clearableText({ max: 2_000, multiline: true }),
  })
  .partial()
  .refine((v) => v.status !== undefined || v.staffNote !== undefined, 'nothing to change');

const messageSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  topic: true,
  orderNumber: true,
  message: true,
  status: true,
  staffNote: true,
  createdAt: true,
  updatedAt: true,
  handledBy: { select: { id: true, name: true } },
} satisfies Prisma.ContactMessageSelect;

const messageNotFound = () => notFound('MESSAGE_NOT_FOUND', 'Message not found.');

@Injectable()
export class AdminContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InboxQuery) {
    const phone = query.q ? normalizePkMobile(query.q) : null;
    const where: Prisma.ContactMessageWhereInput = {
      status: query.status,
      topic: query.topic,
      id: query.before ? { lt: query.before } : undefined,
      ...(query.q
        ? {
            OR: [
              ...(phone ? [{ phone }] : []),
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { orderNumber: query.q.toUpperCase() },
              { subject: { contains: query.q, mode: 'insensitive' } },
              { message: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.contactMessage.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: messageSelect,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ message, ...m }) => ({ ...m, preview: message.slice(0, 160) })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async counts() {
    const groups = await this.prisma.contactMessage.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(
      contactStatuses.map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0]),
    );
  }

  /** The full message, plus the order it mentions when that order exists. */
  async get(id: string) {
    const row = await this.prisma.contactMessage.findUnique({
      where: { id },
      select: messageSelect,
    });
    if (!row) throw messageNotFound();
    const order = row.orderNumber
      ? await this.prisma.order.findUnique({
          where: { number: row.orderNumber },
          select: { number: true, status: true, paymentStatus: true, totalMinor: true },
        })
      : null;
    return { ...row, order };
  }

  async update(id: string, input: z.infer<typeof updateMessageSchema>, actor: AuditActor) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, 'contact_messages', id))) throw messageNotFound();
      const before = await tx.contactMessage.findUniqueOrThrow({
        where: { id },
        select: { status: true, staffNote: true },
      });
      await tx.contactMessage.update({
        where: { id },
        data: { ...input, handledByStaffId: actor.staffId },
      });
      await this.audit.record(
        actor,
        {
          action: 'contact.update',
          entityType: 'contact_message',
          entityId: id,
          changes: diff(before, input),
        },
        tx,
      );
    });
    return this.get(id);
  }
}

@ApiTags('Admin · Inbox')
@Controller('admin/inbox')
export class AdminContactController {
  constructor(private readonly inbox: AdminContactService) {}

  @Get()
  @Staff('inbox.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Contact messages, newest first' })
  list(@Query({ schema: inboxQuerySchema }) query: InboxQuery) {
    return this.inbox.list(query);
  }

  @Get('counts')
  @Staff('inbox.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Messages per status (NEW = unread)' })
  counts() {
    return this.inbox.counts();
  }

  @Get(':id')
  @Staff('inbox.read')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', { schema: z.uuid() }) id: string) {
    return this.inbox.get(id);
  }

  @Patch(':id')
  @Staff('inbox.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Mark read / archived, or set the internal note' })
  update(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: updateMessageSchema }) body: z.infer<typeof updateMessageSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.inbox.update(id, body, actor);
  }
}
