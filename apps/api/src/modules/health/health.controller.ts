import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

/** Heap ceiling before the instance reports itself unhealthy (it should be restarted). */
const MAX_HEAP_BYTES = 768 * 1024 * 1024;

/**
 * `/api/health/live` — the process is up (no dependencies; used to restart a stuck container).
 * `/api/health/ready` — the instance can serve traffic (database, Redis and storage checks are
 * added here as those modules arrive). Load balancers route only to ready instances.
 */
@ApiTags('Health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', MAX_HEAP_BYTES)]);
  }
}
