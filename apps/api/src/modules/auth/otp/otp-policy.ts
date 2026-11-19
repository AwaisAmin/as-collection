import { OTP_TTL_MINUTES } from './otp-sender.js';

/** Login-code rules. Counted in Postgres, so they hold across instances and without Redis. */
export const OTP_POLICY = {
  length: 6,
  ttlMs: OTP_TTL_MINUTES * 60_000,
  /** Wrong guesses per code; then a new code is needed (≤ 25 guesses per phone per window). */
  maxAttempts: 5,
  /** Minimum gap between two codes for the same phone. */
  resendCooldownMs: 30_000,
  /** Codes per phone per window (SMS cost and spam protection). */
  maxPerPhone: 5,
  phoneWindowMs: 15 * 60_000,
  /** Codes per requester IP per window (stops one client pumping many numbers). */
  maxPerIp: 20,
  ipWindowMs: 60 * 60_000,
} as const;

export type OtpRequestDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Whether another code may be sent.
 * @param phoneRequests creation times of this phone's codes within `phoneWindowMs`, newest first
 * @param ipRequests creation times of this IP's codes within `ipWindowMs`, newest first
 */
export function decideOtpRequest(
  phoneRequests: readonly Date[],
  ipRequests: readonly Date[],
  now: Date,
  policy = OTP_POLICY,
): OtpRequestDecision {
  const t = now.getTime();
  const wait = (ms: number): OtpRequestDecision => ({
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(ms / 1000)),
  });

  const newest = phoneRequests[0];
  if (newest && t - newest.getTime() < policy.resendCooldownMs) {
    return wait(policy.resendCooldownMs - (t - newest.getTime()));
  }
  if (phoneRequests.length >= policy.maxPerPhone) {
    // Allowed again once the oldest code counted in the window leaves it.
    const oldest = phoneRequests[policy.maxPerPhone - 1] ?? newest;
    if (oldest) return wait(policy.phoneWindowMs - (t - oldest.getTime()));
  }
  if (ipRequests.length >= policy.maxPerIp) {
    const oldest = ipRequests[policy.maxPerIp - 1];
    if (oldest) return wait(policy.ipWindowMs - (t - oldest.getTime()));
  }
  return { allowed: true };
}
