import { Readable } from 'node:stream';

import type {
  AdminSubscriberCountsDto,
  AdminSubscriberListDto,
  SubscriberStatus,
} from '@as/contracts';
import { Controller, Get, Header, Injectable, Query, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService } from '../../audit/audit.service.js';
import { Actor, Staff } from '../../staff/staff-auth.guard.js';

/*
 * Staff view of newsletter subscribers and a CSV export for the mailing tool. The export
 * streams in keyset batches (constant memory), is audited (it is a copy of personal data) and
 * neutralises spreadsheet formulas.
 */

const statuses = ['SUBSCRIBED', 'UNSUBSCRIBED'] as const satisfies SubscriberStatus[];

export const subscribersQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const exportQuerySchema = z.object({
  status: z.enum(statuses).default('SUBSCRIBED'),
});

const EXPORT_BATCH = 1_000;

/**
 * One CSV cell: quoted when needed, and prefixed with `'` when it would start a formula in
 * Excel / Sheets (CSV injection: `=HYPERLINK(...)`, `+cmd`, `-`, `@`, tab, CR).
 */
export function csvCell(value: string | null): string {
  if (value === null) return '';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

@Injectable()
export class AdminNewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: z.infer<typeof subscribersQuerySchema>): Promise<AdminSubscriberListDto> {
    const rows = await this.prisma.newsletterSubscriber.findMany({
      where: {
        status: query.status,
        email: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
        id: query.before ? { lt: query.before } : undefined,
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        email: true,
        status: true,
        source: true,
        consentAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((s) => ({
        ...s,
        consentAt: s.consentAt.toISOString(),
        unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async counts(): Promise<AdminSubscriberCountsDto> {
    const groups = await this.prisma.newsletterSubscriber.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const count = (status: SubscriberStatus) =>
      groups.find((g) => g.status === status)?._count._all ?? 0;
    return { SUBSCRIBED: count('SUBSCRIBED'), UNSUBSCRIBED: count('UNSUBSCRIBED') };
  }

  /** CSV rows, header first, fetched batch by batch. */
  async *csv(status: (typeof statuses)[number]): AsyncGenerator<string> {
    yield 'email,status,source,consent_at,unsubscribed_at\r\n';
    let after: string | undefined;
    for (;;) {
      const where: Prisma.NewsletterSubscriberWhereInput = {
        status,
        ...(after ? { id: { gt: after } } : {}),
      };
      const batch = await this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { id: 'asc' },
        take: EXPORT_BATCH,
        select: {
          id: true,
          email: true,
          status: true,
          source: true,
          consentAt: true,
          unsubscribedAt: true,
        },
      });
      if (!batch.length) return;
      yield batch
        .map((s) =>
          [
            s.email,
            s.status,
            s.source,
            s.consentAt.toISOString(),
            s.unsubscribedAt?.toISOString() ?? null,
          ]
            .map(csvCell)
            .join(','),
        )
        .map((line) => `${line}\r\n`)
        .join('');
      after = batch.at(-1)?.id;
      if (batch.length < EXPORT_BATCH) return;
    }
  }

  async recordExport(status: string, actor: AuditActor) {
    const count = await this.prisma.newsletterSubscriber.count({
      where: { status: status as (typeof statuses)[number] },
    });
    await this.audit.record(actor, {
      action: 'newsletter.export',
      entityType: 'newsletter',
      changes: { status, count },
    });
  }
}

@ApiTags('Admin · Newsletter')
@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletter: AdminNewsletterService) {}

  @Get('subscribers')
  @Staff('newsletter.read')
  @Header('Cache-Control', 'no-store')
  list(@Query({ schema: subscribersQuerySchema }) query: z.infer<typeof subscribersQuerySchema>) {
    return this.newsletter.list(query);
  }

  @Get('counts')
  @Staff('newsletter.read')
  @Header('Cache-Control', 'no-store')
  counts() {
    return this.newsletter.counts();
  }

  @Get('export.csv')
  @Staff('newsletter.read')
  @Header('Cache-Control', 'no-store')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Download subscribers as CSV (audited)' })
  async export(
    @Query({ schema: exportQuerySchema }) query: z.infer<typeof exportQuerySchema>,
    @Actor() actor: AuditActor,
  ) {
    await this.newsletter.recordExport(query.status, actor);
    const date = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Readable.from(this.newsletter.csv(query.status)), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="subscribers-${query.status.toLowerCase()}-${date}.csv"`,
    });
  }
}
