import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../../database/prisma.service.js';
import { RedisHealthIndicator } from '../../redis/redis.health.js';

/** Heap ceiling before the instance reports itself unhealthy (it should be restarted). */
const MAX_HEAP_BYTES = 768 * 1024 * 1024;

/**
 * `/api/health/live` — the process is up (no dependencies; used to restart a stuck container).
 * `/api/health/ready` — the instance can serve traffic: memory is fine and PostgreSQL answers.
 * Redis is reported but only as degraded when down. Load balancers route only to ready
 * instances.
 */
@ApiTags('Health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', MAX_HEAP_BYTES),
      () => this.db.pingCheck('database', this.prisma).withTimeout(2_000),
      // Degraded (still 200) when Redis is down: the API serves from Postgres without its cache.
      () => this.redis.check('redis'),
    ]);
  }
}
