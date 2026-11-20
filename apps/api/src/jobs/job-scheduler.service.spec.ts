import type { Redis } from 'ioredis';

import type { AppConfig } from '../app.module.js';
import { type JobDefinition, JobScheduler } from './job-scheduler.service.js';

const config = { get: () => false } as unknown as AppConfig;

function schedulerWith(redis: Partial<Redis>) {
  return new JobScheduler(redis as Redis, config);
}

const job = (run: JobDefinition['run']): JobDefinition => ({
  name: 'test',
  intervalMs: 60_000,
  run,
});

describe('JobScheduler', () => {
  it('runs the job when it gets the lock, then releases it', async () => {
    const evalMock = vi.fn().mockResolvedValue(1);
    const scheduler = schedulerWith({ set: vi.fn().mockResolvedValue('OK'), eval: evalMock });
    const run = vi.fn().mockResolvedValue({ done: 1 });
    await scheduler.tick(job(run));
    expect(run).toHaveBeenCalledOnce();
    expect(evalMock).toHaveBeenCalledOnce();
  });

  it('skips the tick when another instance holds the lock', async () => {
    const scheduler = schedulerWith({ set: vi.fn().mockResolvedValue(null), eval: vi.fn() });
    const run = vi.fn().mockResolvedValue({});
    await scheduler.tick(job(run));
    expect(run).not.toHaveBeenCalled();
  });

  it('still runs when Redis is unavailable (jobs are idempotent)', async () => {
    const evalMock = vi.fn();
    const scheduler = schedulerWith({
      set: vi.fn().mockRejectedValue(new Error('down')),
      eval: evalMock,
    });
    const run = vi.fn().mockResolvedValue({});
    await scheduler.tick(job(run));
    expect(run).toHaveBeenCalledOnce();
    expect(evalMock).not.toHaveBeenCalled();
  });

  it('never overlaps runs of the same job and survives failures', async () => {
    const scheduler = schedulerWith({
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    });
    let release: () => void = () => undefined;
    const run = vi.fn(
      () =>
        new Promise<Record<string, number>>((resolve) => {
          release = () => {
            resolve({});
          };
        }),
    );
    const definition = job(run);
    const first = scheduler.tick(definition);
    await scheduler.tick(definition); // returns immediately: already running
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledOnce();
    });
    release();
    await first;

    const failing = job(vi.fn().mockRejectedValue(new Error('boom')));
    await expect(scheduler.tick(failing)).resolves.toBeUndefined();
  });
});
