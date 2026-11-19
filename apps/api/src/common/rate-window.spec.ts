import { windowRetryAfterSeconds } from './rate-window.js';

const now = new Date('2026-11-20T12:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const HOUR = 3_600_000;

describe('windowRetryAfterSeconds', () => {
  it('allows while under the limit', () => {
    expect(windowRetryAfterSeconds([ago(1), ago(2)], 3, HOUR, now)).toBeNull();
  });

  it('waits until the oldest counted event leaves the window', () => {
    expect(windowRetryAfterSeconds([ago(1), ago(20), ago(50)], 3, HOUR, now)).toBe(600);
  });

  it('allows once the window has passed', () => {
    expect(windowRetryAfterSeconds([ago(1), ago(2), ago(60)], 3, HOUR, now)).toBeNull();
  });
});
