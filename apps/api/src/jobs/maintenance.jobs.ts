import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../app.module.js';
import { DomainException } from '../common/http/problem-details.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AdminOrdersService } from '../modules/orders/admin/admin-orders.service.js';
import { JobScheduler } from './job-scheduler.service.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Orders auto-cancelled per run (the next run continues; keeps each run short). */
export const AUTO_CANCEL_BATCH = 100;
/** Rows deleted per statement, so cleanup never holds long locks or bloats WAL in one go. */
export const CLEANUP_BATCH = 5_000;
/** Ended sessions are kept this long (support: "was I signed in from …?"). */
export const SESSION_RETENTION_MS = 30 * DAY;
/** OTP challenges are only needed for rate limits (hours); kept a day. */
export const OTP_RETENTION_MS = DAY;

const SYSTEM = { staffId: null, ip: null, userAgent: null };

/**
 * Maintenance jobs: cancel transfer orders that were never paid (frees their reserved stock)
 * and delete expired auth data. Both are idempotent and safe to run concurrently.
 */
@Injectable()
export class MaintenanceJobs implements OnModuleInit {
  private readonly logger = new Logger('Jobs');
  private readonly windowMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: AdminOrdersService,
    private readonly scheduler: JobScheduler,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.windowMs = config.get('TRANSFER_PAYMENT_WINDOW_HOURS', { infer: true }) * 3_600_000;
  }

  onModuleInit(): void {
    this.scheduler.register({
      name: 'cancel-unpaid-transfers',
      intervalMs: 5 * MINUTE,
      run: () => this.cancelUnpaidTransfers(),
    });
    this.scheduler.register({
      name: 'cleanup-auth',
      intervalMs: 60 * MINUTE,
      run: () => this.cleanupAuth(),
    });
  }

  /**
   * Transfer orders still unpaid after the payment window are cancelled. Orders with a
   * screenshot waiting for review are left alone (that is staff's call).
   */
  async cancelUnpaidTransfers(now = new Date()): Promise<{ cancelled: number; skipped: number }> {
    const hours = Math.round(this.windowMs / 3_600_000);
    const due = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentMethod: { not: 'COD' },
        paymentStatus: { in: ['UNPAID', 'FAILED'] },
        placedAt: { lt: new Date(now.getTime() - this.windowMs) },
      },
      orderBy: { placedAt: 'asc' },
      take: AUTO_CANCEL_BATCH,
      select: { id: true, number: true },
    });
    let cancelled = 0;
    let skipped = 0;
    for (const order of due) {
      try {
        await this.orders.transitionById(
          order.id,
          {
            action: 'cancel',
            reason: `Automatic: no verified payment within ${String(hours)} hours.`,
            customerMessage: `Cancelled automatically: we did not receive your payment within ${String(hours)} hours. You are welcome to order again.`,
            onlyIfUnpaid: true,
          },
          SYSTEM,
        );
        cancelled += 1;
      } catch (error) {
        // State changed since it was picked (paid, cancelled by the customer…): nothing to do.
        if (error instanceof DomainException) {
          skipped += 1;
          continue;
        }
        this.logger.error(`Auto-cancel of ${order.number} failed`, (error as Error).stack);
        skipped += 1;
      }
    }
    return { cancelled, skipped };
  }

  async cleanupAuth(now = new Date()) {
    const sessionsBefore = new Date(now.getTime() - SESSION_RETENTION_MS);
    const otpBefore = new Date(now.getTime() - OTP_RETENTION_MS);
    return {
      otpChallenges: await this.deleteInBatches(
        Prisma.sql`SELECT id FROM otp_challenges WHERE created_at < ${otpBefore}`,
        'otp_challenges',
      ),
      customerSessions: await this.deleteInBatches(
        Prisma.sql`SELECT id FROM customer_sessions
                   WHERE expires_at < ${sessionsBefore} OR revoked_at < ${sessionsBefore}`,
        'customer_sessions',
      ),
      staffSessions: await this.deleteInBatches(
        Prisma.sql`SELECT id FROM staff_sessions
                   WHERE expires_at < ${sessionsBefore} OR revoked_at < ${sessionsBefore}`,
        'staff_sessions',
      ),
      stockReservations: await this.deleteInBatches(
        Prisma.sql`SELECT id FROM stock_reservations WHERE expires_at < ${now}`,
        'stock_reservations',
      ),
    };
  }

  private async deleteInBatches(select: Prisma.Sql, table: string): Promise<number> {
    let total = 0;
    for (;;) {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM ${Prisma.raw(`"${table}"`)}
        WHERE id IN (${select} LIMIT ${CLEANUP_BATCH})`;
      total += deleted;
      if (deleted < CLEANUP_BATCH) return total;
    }
  }
}
