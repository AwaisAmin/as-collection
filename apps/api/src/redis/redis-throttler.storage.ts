import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants.js';

/**
 * Fixed window per key + optional block, atomically in one round trip.
 * Returns [totalHits, windowMsLeft, isBlocked (0/1), blockMsLeft].
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { tonumber(ARGV[2]) + 1, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  if block > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', block)
    return { hits, ttl, 1, block }
  end
  return { hits, ttl, 1, ttl }
end
return { hits, ttl, 0, 0 }
`;

type ScriptResult = [number, number, number, number];
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Rate-limit counters shared by every API instance (a per-process limit multiplies with the
 * number of instances). Falls back to per-process memory while Redis is unavailable, so limits
 * stay enforced — only less precisely — and requests never fail because of Redis.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly fallback = new ThrottlerStorageService();

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis.status === 'ready') {
      try {
        const base = `as:throttle:${throttlerName}:${key}`;
        const [totalHits, ttlMs, blocked, blockMs] = (await this.redis.eval(
          INCREMENT_SCRIPT,
          2,
          base,
          `${base}:blocked`,
          ttl,
          limit,
          blockDuration,
        )) as ScriptResult;
        return {
          totalHits,
          timeToExpire: Math.ceil(ttlMs / 1000),
          isBlocked: blocked === 1,
          timeToBlockExpire: Math.ceil(blockMs / 1000),
        };
      } catch {
        // fall through to the in-memory limiter
      }
    }
    return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
  }
}
