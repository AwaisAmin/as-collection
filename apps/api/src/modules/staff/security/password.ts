import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

/*
 * argon2id with the library defaults, which match the OWASP recommendation (m=19 MiB, t=2, p=1).
 * Passwords follow NIST SP 800-63B: length over composition rules, no forced rotation.
 */

export const PASSWORD_MIN = 12;
/** Upper bound keeps hashing cost bounded (no "long password" DoS). */
export const PASSWORD_MAX = 128;

export const hashPassword = (password: string) => hash(password);

/** Constant-ish time: never throws on malformed hashes, just returns false. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash of a random string, verified against when the email is unknown (same timing). */
let dummyHash: Promise<string> | undefined;
export const dummyPasswordHash = () => (dummyHash ??= hash(`dummy-${String(Math.random())}`));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters.`)
  .max(PASSWORD_MAX, `Use at most ${String(PASSWORD_MAX)} characters.`)
  .refine((v) => new Set(v).size >= 5, 'Use a less repetitive password.');

/** Rejects passwords that contain the account's email name (e.g. "ayesha" for ayesha@…). */
export function passwordMentionsEmail(password: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return local.length >= 4 && password.toLowerCase().includes(local);
}
