import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RedisModule } from './redis/redis.module.js';

/** Typed access to the validated environment: `config.get('PORT', { infer: true })`. */
export type AppConfig = ConfigService<Env, true>;

/**
 * Root module. Built from an already-validated `Env` (see `main.ts`), so the environment is
 * parsed exactly once and tests can boot the app with their own config — no global state.
 */
@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          ignoreEnvFile: true,
          load: [() => env],
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: env.RATE_LIMIT_TTL_MS, limit: env.RATE_LIMIT_MAX }],
        }),
        DatabaseModule,
        RedisModule,
        HealthModule,
        CatalogModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
