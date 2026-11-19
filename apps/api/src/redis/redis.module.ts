import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { AppConfig } from '../app.module.js';
import { CacheService } from './cache.service.js';
import { REDIS } from './redis.constants.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

export { REDIS } from './redis.constants.js';

function createRedis(config: AppConfig): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(config.get('REDIS_URL', { infer: true }), {
    connectionName: 'as-collection-api',
    // Fail fast instead of queueing commands forever while Redis is down (cache is fail-open).
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    commandTimeout: 1_000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    lazyConnect: false,
  });
  let lastError = 0;
  client.on('error', (error: Error) => {
    // Throttle: one warning per minute is enough while Redis is unreachable.
    if (Date.now() - lastError > 60_000) {
      lastError = Date.now();
      logger.warn(`Redis unavailable: ${error.message}`);
    }
  });
  client.on('ready', () => {
    logger.log('Redis connected');
  });
  return client;
}

/** How long startup waits for Redis before serving without it (cache and limits fail open). */
const STARTUP_WAIT_MS = 3_000;

@Injectable()
class RedisLifecycle implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Avoids a burst of cache misses and per-process rate counting right after boot. */
  async onModuleInit(): Promise<void> {
    if (this.redis.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, STARTUP_WAIT_MS);
      this.redis.once('ready', done);
      function done() {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'end') return;
    await this.redis.quit().catch(() => {
      this.redis.disconnect();
    });
  }
}

/** Global Redis client (`@Inject(REDIS)`), the read-through `CacheService` and rate-limit storage. */
@Global()
@Module({
  providers: [
    { provide: REDIS, inject: [ConfigService], useFactory: createRedis },
    RedisLifecycle,
    CacheService,
    RedisThrottlerStorage,
  ],
  exports: [REDIS, CacheService, RedisThrottlerStorage],
})
export class RedisModule {}
