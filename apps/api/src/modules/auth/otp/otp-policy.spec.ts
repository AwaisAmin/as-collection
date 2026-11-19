import { decideOtpRequest, OTP_POLICY } from './otp-policy.js';

const now = new Date('2026-11-19T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const times = (count: number, stepMs: number, startMs = 0) =>
  Array.from({ length: count }, (_, i) => ago(startMs + i * stepMs));

describe('decideOtpRequest', () => {
  it('allows the first code', () => {
    expect(decideOtpRequest([], [], now)).toEqual({ allowed: true });
  });

  it('enforces the resend cooldown', () => {
    expect(decideOtpRequest([ago(10_000)], [], now)).toEqual({
      allowed: false,
      retryAfterSeconds: 20,
    });
    expect(decideOtpRequest([ago(OTP_POLICY.resendCooldownMs)], [], now)).toEqual({
      allowed: true,
    });
  });

  it('caps codes per phone per window, reopening when the oldest leaves it', () => {
    // 5 codes, newest 1 min ago, oldest 5 min ago → allowed again in 10 min.
    const recent = times(OTP_POLICY.maxPerPhone, 60_000, 60_000);
    expect(decideOtpRequest(recent, [], now)).toEqual({
      allowed: false,
      retryAfterSeconds: 10 * 60,
    });
    expect(decideOtpRequest(recent.slice(0, 4), [], now)).toEqual({ allowed: true });
  });

  it('caps codes per IP across phones', () => {
    const ipRecent = times(OTP_POLICY.maxPerIp, 60_000, 60_000);
    const decision = decideOtpRequest([], ipRecent, now);
    expect(decision.allowed).toBe(false);
    expect(decideOtpRequest([], ipRecent.slice(1), now)).toEqual({ allowed: true });
  });
});
