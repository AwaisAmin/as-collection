import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { isStrictRateLimited } from './common/http/rate-limit.js';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NewsletterModule } from './modules/newsletter/newsletter.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage.js';
import { StorageModule } from './storage/storage.module.js';

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
        DatabaseModule,
        RedisModule,
        StorageModule,
        // Per client IP, counted in Redis so the limit holds across every API instance.
        ThrottlerModule.forRootAsync({
          inject: [RedisThrottlerStorage],
          useFactory: (storage: RedisThrottlerStorage) => ({
            throttlers: [
              { name: 'default', ttl: env.RATE_LIMIT_TTL_MS, limit: env.RATE_LIMIT_MAX },
              {
                name: 'strict',
                ttl: 60_000,
                limit: env.AUTH_RATE_LIMIT_MAX,
                skipIf: (context) => !isStrictRateLimited(context),
              },
            ],
            storage,
          }),
        }),
        HealthModule,
        CatalogModule,
        AuthModule,
        AccountModule,
        OrdersModule,
        ReviewsModule,
        NewsletterModule,
        ContactModule,
        ContentModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
