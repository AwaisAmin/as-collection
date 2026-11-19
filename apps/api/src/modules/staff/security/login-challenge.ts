import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived proof that the password step succeeded, carried to the 2FA step. Stateless (HMAC),
 * bound to the staff member, its purpose, and the current password version — changing the
 * password invalidates outstanding challenges. Brute-forcing the code is limited by the account
 * lockout, not by the challenge.
 */
export type ChallengePurpose = 'totp' | 'enrol';

export const CHALLENGE_TTL_MS = 5 * 60_000;

interface ChallengePayload {
  sid: string;
  p: ChallengePurpose;
  exp: number;
  /** Password version: `passwordChangedAt` in ms (0 if never changed). */
  pv: number;
}

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(`staff-challenge:${payload}`).digest();

export function issueChallenge(
  secret: string,
  staffId: string,
  purpose: ChallengePurpose,
  passwordVersion: number,
  now: Date,
): string {
  const payload: ChallengePayload = {
    sid: staffId,
    p: purpose,
    exp: now.getTime() + CHALLENGE_TTL_MS,
    pv: passwordVersion,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(secret, encoded).toString('base64url')}`;
}

/** The challenge's staff id and password version, or `null` if invalid/expired/wrong purpose. */
export function readChallenge(
  secret: string,
  token: string,
  purposes: readonly ChallengePurpose[],
  now: Date,
): { staffId: string; purpose: ChallengePurpose; passwordVersion: number } | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(secret, encoded);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as ChallengePayload;
    if (payload.exp <= now.getTime() || !purposes.includes(payload.p)) return null;
    return { staffId: payload.sid, purpose: payload.p, passwordVersion: payload.pv };
  } catch {
    return null;
  }
}
