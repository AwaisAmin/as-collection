import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { AppConfig } from '../app.module.js';
import { REDIS } from '../redis/redis.constants.js';

export interface JobDefinition {
  name: string;
  intervalMs: number;
  run: () => Promise<Record<string, number>>;
}

/** Deletes the lock only if we still own it (a slow run must not release someone else's). */
const RELEASE_LOCK = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0`;

/**
 * Minimal in-process scheduler for maintenance jobs. With several API instances, a Redis lock
 * makes one instance run each tick; if Redis is down every instance runs — harmless, because
 * every job is idempotent and works under row locks. Runs never overlap within a process, start
 * with jitter (instances do not fire together), and shutdown waits for a running job.
 */
@Injectable()
export class JobScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private readonly jobs: JobDefinition[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly enabled: boolean;
  private stopped = false;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.enabled = config.get('JOBS_ENABLED', { infer: true });
  }

  register(job: JobDefinition): void {
    this.jobs.push(job);
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    for (const job of this.jobs) {
      const first = setTimeout(
        () => {
          void this.tick(job);
          const interval = setInterval(() => void this.tick(job), job.intervalMs);
          interval.unref();
          this.timers.add(interval);
        },
        5_000 + Math.random() * 25_000,
      );
      first.unref();
      this.timers.add(first);
    }
    this.logger.log(`Scheduled ${this.jobs.map((j) => j.name).join(', ')}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled(this.running.values());
  }

  /** Runs one job now (with the lock); also used by tests and ops tooling. */
  async tick(job: JobDefinition): Promise<void> {
    if (this.stopped || this.running.has(job.name)) return;
    const run = this.runLocked(job).finally(() => this.running.delete(job.name));
    this.running.set(job.name, run);
    await run;
  }

  private async runLocked(job: JobDefinition): Promise<void> {
    const key = `as:lock:job:${job.name}`;
    const token = randomUUID();
    const lock = await this.redis
      .set(key, token, 'PX', job.intervalMs, 'NX')
      .catch(() => 'unavailable' as const);
    if (lock === null) return; // another instance has this tick
    const started = Date.now();
    try {
      const result = await job.run();
      const changed = Object.values(result).some((n) => n > 0);
      const summary = Object.entries(result)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');
      const message = `${job.name} done in ${String(Date.now() - started)} ms ${summary}`;
      if (changed) this.logger.log(message);
      else this.logger.debug(message);
    } catch (error) {
      this.logger.error(`${job.name} failed`, error instanceof Error ? error.stack : String(error));
    } finally {
      if (lock === 'OK') await this.redis.eval(RELEASE_LOCK, 1, key, token).catch(() => 0);
    }
  }
}
