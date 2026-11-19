import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { AppConfig } from '../app.module.js';
import { CacheService } from './cache.service.js';
import { REDIS } from './redis.constants.js';

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

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'end') return;
    await this.redis.quit().catch(() => {
      this.redis.disconnect();
    });
  }
}

/** Global Redis client (`@Inject(REDIS)`) and the read-through `CacheService`. */
@Global()
@Module({
  providers: [
    { provide: REDIS, inject: [ConfigService], useFactory: createRedis },
    RedisLifecycle,
    CacheService,
  ],
  exports: [REDIS, CacheService],
})
export class RedisModule {}
