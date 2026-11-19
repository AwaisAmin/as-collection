import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { AppConfig } from '../app.module.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Route Prisma warnings and errors to events (→ Nest logger) instead of stdout. */
const LOG_EVENTS = [
  { level: 'warn', emit: 'event' },
  { level: 'error', emit: 'event' },
] as const satisfies { level: 'warn' | 'error'; emit: 'event' }[];

interface ClientOptions {
  adapter: PrismaPg;
  log: typeof LOG_EVENTS;
}

/**
 * The single database client of the app (one connection pool per instance).
 *
 * Prisma 7 talks to Postgres through the `pg` driver adapter. The pool connects lazily on the
 * first query; every connection gets a statement timeout so a runaway query can't hold it.
 * Prisma warnings and errors go through the Nest logger (JSON in production).
 */
@Injectable()
export class PrismaService extends PrismaClient<ClientOptions> implements OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor(@Inject(ConfigService) config: AppConfig) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
      connectionTimeoutMillis: config.get('DATABASE_CONNECT_TIMEOUT_MS', { infer: true }),
      idleTimeoutMillis: 30_000,
      statement_timeout: config.get('DATABASE_STATEMENT_TIMEOUT_MS', { infer: true }),
      application_name: 'as-collection-api',
    });
    super({ adapter, log: LOG_EVENTS });
    this.$on('warn', (event) => {
      this.logger.warn(event.message, { target: event.target });
    });
    this.$on('error', (event) => {
      this.logger.error(event.message, { target: event.target });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
