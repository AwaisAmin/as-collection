import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants.js';

const PREFIX = 'as:cache';

/** Stable JSON: object keys sorted, so `{a,b}` and `{b,a}` produce the same cache key. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

/** Short, fixed-length key part for arbitrary inputs (queries, filters). */
export const hashKey = (value: unknown) =>
  createHash('sha256').update(stableStringify(value)).digest('base64url').slice(0, 22);

/**
 * Read-through JSON cache on Redis.
 *
 * - **Namespaced versions**: keys embed the namespace's version (`catalog:v7:…`). `invalidate`
 *   bumps the version, so every old entry is instantly unreachable (and expires by TTL) — O(1),
 *   no key scans, safe across many API instances.
 * - **Single-flight**: concurrent misses for the same key share one loader call (no stampede).
 * - **Fail-open**: if Redis is down or slow, the loader runs directly; requests never fail because
 *   of the cache.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger('Cache');
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getOrSet<T>(
    namespace: string,
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (ttlSeconds <= 0) return loader();
    const version = await this.safe(() => this.redis.get(this.versionKey(namespace)), null);
    const fullKey = `${PREFIX}:${namespace}:v${version ?? '0'}:${key}`;

    const pending = this.inFlight.get(fullKey);
    if (pending) return pending as Promise<T>;

    const promise = (async () => {
      const cached = await this.safe(() => this.redis.get(fullKey), null);
      if (cached !== null) return JSON.parse(cached) as T;
      const value = await loader();
      await this.safe(() => this.redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds), null);
      return value;
    })().finally(() => this.inFlight.delete(fullKey));

    this.inFlight.set(fullKey, promise);
    return promise;
  }

  /** Plain JSON read of `as:<key>`; `null` on a miss or when Redis is unavailable. */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.safe(() => this.redis.get(`as:${key}`), null);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.safe(
      () => this.redis.set(`as:${key}`, JSON.stringify(value), 'EX', ttlSeconds),
      null,
    );
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.safe(() => this.redis.del(...keys.map((key) => `as:${key}`)), null);
  }

  /** Makes every cached entry of `namespace` stale immediately. */
  async invalidate(namespace: string): Promise<void> {
    await this.safe(() => this.redis.incr(this.versionKey(namespace)), null);
  }

  private versionKey(namespace: string): string {
    return `${PREFIX}:${namespace}:version`;
  }

  private async safe<T, F>(operation: () => Promise<T>, fallback: F): Promise<T | F> {
    if (this.redis.status !== 'ready') return fallback;
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(`Cache bypassed: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }
}
