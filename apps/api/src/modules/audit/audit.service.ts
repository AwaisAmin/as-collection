import type { AdminAuditListDto } from '@as/contracts';
import { Injectable } from '@nestjs/common';

import type { JsonValue } from '../../common/http/problem-details.js';
import { currentRequestId } from '../../common/request-context.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** Who did it, from where. */
export interface AuditActor {
  staffId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditEntry {
  /** Dotted verb, e.g. "staff.create", "role.update", "order.status.change". */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** `{ before, after }` (use `diff`) or any extra context. Secrets are redacted automatically. */
  changes?: Record<string, unknown> | null;
}

const SECRET_KEY = /password|passwd|secret|token|totp|hash|^otp|api_?key|access_?key|private_?key/i;

/** Deep copy with secret-looking fields replaced, so the log never holds credentials. */
export function redact(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) ? '[redacted]' : redact(v),
      ]),
    );
  }
  if (value === undefined) return null;
  return value as JsonValue;
}

/** Only the fields that changed, as `{ before, after }` (null when nothing changed). */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (after[key] === undefined) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return Object.keys(changedAfter).length ? { before: changedBefore, after: changedAfter } : null;
}

/**
 * Append-only audit trail (the database refuses updates and deletes). Pass the transaction
 * client so the entry commits — or rolls back — with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: AuditActor,
    entry: AuditEntry,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: actor.staffId ? 'STAFF' : 'SYSTEM',
        actorStaffId: actor.staffId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: entry.changes ? (redact(entry.changes) as Prisma.InputJsonValue) : undefined,
        ipAddress: actor.ip?.slice(0, 45) ?? null,
        userAgent: actor.userAgent?.slice(0, 512) ?? null,
        requestId: currentRequestId() ?? null,
      },
    });
  }

  /** Newest first, keyset-paginated by id (UUIDv7 ids are time-ordered). */
  async list(query: {
    actorStaffId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    before?: string;
    limit: number;
  }): Promise<AdminAuditListDto> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        actorStaffId: query.actorStaffId,
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action ? { startsWith: query.action } : undefined,
        id: query.before ? { lt: query.before } : undefined,
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        actorType: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
        actorStaff: { select: { id: true, name: true, email: true } },
      },
    });
    const items = rows.slice(0, query.limit);
    return {
      items: items.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }
}
