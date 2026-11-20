import { Semaphore } from './semaphore.js';

describe('Semaphore', () => {
  it('never runs more tasks than its capacity, and runs them all', async () => {
    const semaphore = new Semaphore(2);
    let running = 0;
    let peak = 0;
    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    };
    await Promise.all(Array.from({ length: 7 }, () => semaphore.run(task)));
    expect(peak).toBe(2);
    expect(running).toBe(0);
  });

  it('releases the slot when a task fails', async () => {
    const semaphore = new Semaphore(1);
    await expect(semaphore.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(semaphore.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
