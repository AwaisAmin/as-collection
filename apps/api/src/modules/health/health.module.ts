import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisHealthIndicator } from '../../redis/redis.health.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule.forRoot({ errorLogStyle: 'json', gracefulShutdownTimeoutMs: 1000 })],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
