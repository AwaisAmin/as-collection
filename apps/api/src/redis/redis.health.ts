import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants.js';

/**
 * Redis readiness. Reported as DEGRADED (HTTP 200) rather than down: the API keeps serving from
 * Postgres without its cache, so a Redis outage must not take instances out of the load balancer.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(key = 'redis') {
    const indicator = this.indicators.check(key);
    try {
      const started = Date.now();
      await this.redis.ping();
      return indicator.up({ responseTime: Date.now() - started });
    } catch {
      // Public endpoint: no internal error details (the Redis client already logs them).
      return indicator.degraded({ message: 'unavailable' });
    }
  }
}
