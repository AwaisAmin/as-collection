import type { SessionSummaryDto } from '@as/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { randomToken, sha256Hex } from '../../common/crypto.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../redis/cache.service.js';

/** A signed-in customer, as attached to the request by `CustomerAuthGuard`. */
export interface AuthSession {
  sessionId: string;
  customerId: string;
  expiresAt: Date;
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export type SessionSummary = SessionSummaryDto;

interface CachedSession {
  sessionId: string;
  customerId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

const DAY_MS = 86_400_000;
/** Sessions never live longer than this, however often they are used. */
export const SESSION_ABSOLUTE_MAX_MS = 180 * DAY_MS;
/** Activity is written at most this often (sliding expiry without a write per request). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60_000;
/** Older sessions beyond this many are revoked (lost phones, shared computers). */
export const MAX_ACTIVE_SESSIONS = 10;
/** Lookups are cached briefly; revocation deletes the entry, so this only bounds staleness. */
const CACHE_TTL_SECONDS = 60;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

const cacheKey = (tokenHash: string) => `session:${tokenHash}`;

/**
 * Customer sessions: opaque 256-bit bearer tokens. Only SHA-256 hashes are stored (a database
 * leak exposes no usable tokens). Expiry slides with use up to an absolute maximum.
 *
 * Callers that block a customer (admin) must call `revokeAll` — the cache is not status-aware.
 */
@Injectable()
export class SessionService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.ttlMs = config.get('SESSION_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  async create(
    customerId: string,
    client: ClientInfo,
  ): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const session = await this.prisma.customerSession.create({
      data: {
        customerId,
        tokenHash: sha256Hex(token),
        expiresAt,
        ipAddress: client.ip?.slice(0, 45) ?? null,
        userAgent: client.userAgent?.slice(0, 512) ?? null,
      },
      select: { id: true },
    });
    await this.pruneOldSessions(customerId);
    return { token, expiresAt, sessionId: session.id };
  }

  /** The active session for a bearer token, or `null` (unknown, expired, revoked, blocked). */
  async resolve(token: string): Promise<AuthSession | null> {
    if (!TOKEN_FORMAT.test(token)) return null; // no database work for garbage
    const tokenHash = sha256Hex(token);
    const now = Date.now();

    let session = await this.cache.getJson<CachedSession>(cacheKey(tokenHash));
    if (!session) {
      const row = await this.prisma.customerSession.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          customerId: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
          customer: { select: { status: true } },
        },
      });
      if (!row || row.revokedAt || row.customer.status !== 'ACTIVE') return null;
      session = {
        sessionId: row.id,
        customerId: row.customerId,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      };
      await this.cache.setJson(cacheKey(tokenHash), session, CACHE_TTL_SECONDS);
    }

    let expiresAt = new Date(session.expiresAt);
    if (expiresAt.getTime() <= now) return null;

    if (now - new Date(session.lastSeenAt).getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      const absoluteEnd = new Date(session.createdAt).getTime() + SESSION_ABSOLUTE_MAX_MS;
      expiresAt = new Date(Math.min(now + this.ttlMs, absoluteEnd));
      const updated = await this.prisma.customerSession.updateMany({
        where: { id: session.sessionId, revokedAt: null },
        data: { lastSeenAt: new Date(now), expiresAt },
      });
      await this.cache.delete(cacheKey(tokenHash));
      if (updated.count === 0) return null; // revoked meanwhile
    }

    return { sessionId: session.sessionId, customerId: session.customerId, expiresAt };
  }

  async list(customerId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const rows = await this.prisma.customerSession.findMany({
      where: { customerId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      current: row.id === currentSessionId,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  /** Revokes one of the customer's sessions. Returns false if there was nothing to revoke. */
  async revoke(customerId: string, sessionId: string): Promise<boolean> {
    return (await this.revokeWhere({ customerId, id: sessionId })) > 0;
  }

  /** Signs the customer out everywhere (optionally except the current session). */
  async revokeAll(customerId: string, exceptSessionId?: string): Promise<number> {
    return this.revokeWhere({
      customerId,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    });
  }

  private async revokeWhere(where: {
    customerId: string;
    id?: string | { not: string } | { in: string[] };
  }): Promise<number> {
    const sessions = await this.prisma.customerSession.findMany({
      where: { ...where, revokedAt: null },
      select: { id: true, tokenHash: true },
    });
    if (sessions.length === 0) return 0;
    const { count } = await this.prisma.customerSession.updateMany({
      where: { id: { in: sessions.map((s) => s.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.cache.delete(...sessions.map((s) => cacheKey(s.tokenHash)));
    return count;
  }

  private async pruneOldSessions(customerId: string): Promise<void> {
    const stale = await this.prisma.customerSession.findMany({
      where: { customerId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: MAX_ACTIVE_SESSIONS,
      select: { id: true },
    });
    if (stale.length) await this.revokeWhere({ customerId, id: { in: stale.map((s) => s.id) } });
  }
}
