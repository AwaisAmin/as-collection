import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { randomToken, sha256Hex } from '../../common/crypto.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { ClientInfo } from '../auth/session.service.js';

/** Signed-in staff member, resolved fresh on every request (role changes apply immediately). */
export interface StaffPrincipal {
  sessionId: string;
  staffId: string;
  email: string;
  name: string;
  permissions: ReadonlySet<string>;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}

/** Concurrent staff sessions per account; the oldest is signed out beyond this. */
export const MAX_STAFF_SESSIONS = 5;
/** `lastSeenAt` is written at most this often (keeps reads cheap). */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Opaque bearer sessions for the admin panel: only the SHA-256 of the token is stored. Sessions
 * end on logout, after `STAFF_SESSION_IDLE_MINUTES` without use, `STAFF_SESSION_MAX_HOURS` after
 * sign-in, or immediately when the account is disabled. No cache: revocation is instant.
 */
@Injectable()
export class StaffSessionService {
  private readonly idleMs: number;
  private readonly maxMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.idleMs = config.get('STAFF_SESSION_IDLE_MINUTES', { infer: true }) * 60_000;
    this.maxMs = config.get('STAFF_SESSION_MAX_HOURS', { infer: true }) * 3_600_000;
  }

  async create(
    staffId: string,
    client: ClientInfo,
  ): Promise<{ token: string; expiresAt: Date; idleTimeoutMinutes: number }> {
    const token = randomToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.maxMs);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffSession.create({
        data: {
          staffId,
          tokenHash: sha256Hex(token),
          expiresAt,
          lastSeenAt: now,
          ipAddress: client.ip?.slice(0, 45) ?? null,
          userAgent: client.userAgent?.slice(0, 512) ?? null,
        },
      });
      const active = await tx.staffSession.findMany({
        where: { staffId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        skip: MAX_STAFF_SESSIONS,
        select: { id: true },
      });
      if (active.length) {
        await tx.staffSession.updateMany({
          where: { id: { in: active.map((s) => s.id) } },
          data: { revokedAt: now },
        });
      }
    });
    return { token, expiresAt, idleTimeoutMinutes: this.idleMs / 60_000 };
  }

  async resolve(token: string): Promise<StaffPrincipal | null> {
    if (token.length !== 43) return null;
    const now = new Date();
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        revokedAt: true,
        staff: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            mustChangePassword: true,
            totpEnabledAt: true,
            roles: {
              select: { role: { select: { permissions: { select: { permission: true } } } } },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      now.getTime() - session.lastSeenAt.getTime() > this.idleMs ||
      session.staff.status !== 'ACTIVE'
    ) {
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.staffSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }
    const { staff } = session;
    return {
      sessionId: session.id,
      staffId: staff.id,
      email: staff.email,
      name: staff.name,
      permissions: new Set(staff.roles.flatMap((r) => r.role.permissions.map((p) => p.permission))),
      mustChangePassword: staff.mustChangePassword,
      totpEnabled: staff.totpEnabledAt !== null,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Signs the staff member out everywhere (optionally keeping the current session). */
  async revokeAll(staffId: string, exceptSessionId?: string): Promise<number> {
    const { count } = await this.prisma.staffSession.updateMany({
      where: {
        staffId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
