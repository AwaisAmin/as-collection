import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  generateOtp,
  generateSessionToken,
  hashOtp,
  hashToken,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS,
  OTP_REQUEST_WINDOW_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  safeEqualHex,
} from '../lib/otp';
import type {
  Address,
  AddressInput,
  DeviceSession,
  GoogleSignInResult,
  RequestOtpResult,
  User,
  VerifyOtpResult,
} from '../types';
import type { AuthService } from './auth.service';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ───────────── Adapter: in-memory mock (globalThis survives dev hot reloads) ───────────── */

interface Challenge {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}
interface Store {
  users: Map<string, User & { googleId?: string; addresses: Address[] }>;
  byPhone: Map<string, string>;
  challenges: Map<string, Challenge>;
  requestLog: Map<string, number[]>;
  sessions: Map<string, { userId: string; expiresAt: number; createdAt: number }>;
}

const g = globalThis as { __asAuth?: Store };
const store: Store = (g.__asAuth ??= {
  users: new Map(),
  byPhone: new Map(),
  challenges: new Map(),
  requestLog: new Map(),
  sessions: new Map(),
});

/** Server-side secret mixed into OTP hashes (real value comes from env in the API). */
const PEPPER = process.env.OTP_PEPPER ?? 'dev-only-pepper';

const publicUser = ({
  addresses: _a,
  googleId: _g,
  ...user
}: User & { googleId?: string; addresses: Address[] }): User => user;

function mustGetUser(userId: string) {
  const user = store.users.get(userId);
  if (!user) throw new Error('User not found');
  return user;
}

async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const now = Date.now();
  const recent = (store.requestLog.get(phone) ?? []).filter((t) => now - t < OTP_REQUEST_WINDOW_MS);
  const last = recent.at(-1);

  if (last !== undefined && now - last < OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryIn: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - last)) / 1000),
    };
  }
  if (recent.length >= OTP_MAX_REQUESTS) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryIn: Math.ceil((OTP_REQUEST_WINDOW_MS - (now - recent[0]!)) / 1000),
    };
  }

  const code = generateOtp();
  store.challenges.set(phone, {
    codeHash: hashOtp(phone, code, PEPPER),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
  });
  store.requestLog.set(phone, [...recent, now]);

  // Real adapter: send via WhatsApp (fallback SMS). Mock: hand the code back for the dev UI.
  return { ok: true, resendIn: OTP_RESEND_COOLDOWN_MS / 1000, devCode: code };
}

async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const challenge = store.challenges.get(phone);
  if (!challenge) return { ok: false, reason: 'no_challenge' };
  if (Date.now() > challenge.expiresAt) {
    store.challenges.delete(phone);
    return { ok: false, reason: 'expired' };
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    store.challenges.delete(phone);
    return { ok: false, reason: 'too_many_attempts' };
  }

  challenge.attempts += 1;
  if (!safeEqualHex(challenge.codeHash, hashOtp(phone, code, PEPPER))) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - challenge.attempts;
    if (attemptsLeft <= 0) store.challenges.delete(phone);
    return attemptsLeft <= 0
      ? { ok: false, reason: 'too_many_attempts' }
      : { ok: false, reason: 'invalid', attemptsLeft };
  }

  store.challenges.delete(phone); // single use
  const existingId = store.byPhone.get(phone);
  if (existingId) {
    return {
      ok: true,
      user: publicUser(mustGetUser(existingId)),
      isNew: false,
      session: await createSession(existingId),
    };
  }

  const user = {
    id: randomUUID(),
    phone,
    name: '',
    googleLinked: false,
    createdAt: new Date().toISOString(),
    addresses: [],
  };
  store.users.set(user.id, user);
  store.byPhone.set(phone, user.id);
  return { ok: true, user: publicUser(user), isNew: true, session: await createSession(user.id) };
}

async function signInWithGoogle(profile: {
  googleId: string;
  email: string;
  name: string;
}): Promise<User> {
  const existing = [...store.users.values()].find(
    (u) => u.googleId === profile.googleId || u.email === profile.email,
  );
  if (existing) {
    existing.googleId = profile.googleId;
    existing.googleLinked = true;
    existing.name ||= profile.name;
    return publicUser(existing);
  }
  const user = {
    id: randomUUID(),
    phone: '',
    name: profile.name,
    email: profile.email,
    googleId: profile.googleId,
    googleLinked: true,
    createdAt: new Date().toISOString(),
    addresses: [],
  };
  store.users.set(user.id, user);
  return publicUser(user);
}

async function createSession(userId: string) {
  const { token, hash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  store.sessions.set(hash, { userId, expiresAt: expiresAt.getTime(), createdAt: Date.now() });
  return { token, expiresAt };
}

async function getUserBySessionToken(token: string): Promise<User | null> {
  const session = store.sessions.get(hashToken(token));
  if (!session || session.expiresAt < Date.now()) return null;
  const user = store.users.get(session.userId);
  return user ? publicUser(user) : null;
}

async function deleteSession(token: string) {
  store.sessions.delete(hashToken(token));
}

async function updateProfile(userId: string, input: { name: string; email?: string }) {
  const user = mustGetUser(userId);
  user.name = input.name;
  user.email = input.email || undefined;
  return publicUser(user);
}

async function listAddresses(userId: string) {
  return [...mustGetUser(userId).addresses].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
}

async function saveAddress(
  userId: string,
  input: AddressInput,
  addressId?: string,
): Promise<Address> {
  const user = mustGetUser(userId);
  const makeDefault = input.isDefault || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));

  if (addressId) {
    const existing = user.addresses.find((a) => a.id === addressId);
    if (!existing) throw new Error('Address not found');
    Object.assign(existing, { ...input, isDefault: makeDefault || existing.isDefault });
    return existing;
  }
  const address: Address = { ...input, id: randomUUID(), isDefault: makeDefault };
  user.addresses.push(address);
  return address;
}

async function deleteAddress(userId: string, addressId: string) {
  const user = mustGetUser(userId);
  const wasDefault = user.addresses.find((a) => a.id === addressId)?.isDefault;
  user.addresses = user.addresses.filter((a) => a.id !== addressId);
  if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
}

async function setDefaultAddress(userId: string, addressId: string) {
  const user = mustGetUser(userId);
  user.addresses.forEach((a) => (a.isDefault = a.id === addressId));
}

/** Session token → user id (throws when signed out, like the API's 401). */
function userIdOf(token: string): string {
  const session = store.sessions.get(hashToken(token));
  if (!session || session.expiresAt < Date.now()) throw new Error('Not signed in');
  return session.userId;
}

/** Mock Google: any credential signs in the same demo customer. */
async function mockGoogle(): Promise<GoogleSignInResult> {
  const before = store.users.size;
  const user = await signInWithGoogle({
    googleId: 'mock-google-001',
    email: 'demo.customer@gmail.com',
    name: 'Demo Google Customer',
  });
  return {
    ok: true,
    user,
    isNew: store.users.size > before,
    session: await createSession(user.id),
  };
}

function listSessions(token: string): DeviceSession[] {
  const current = hashToken(token);
  const userId = userIdOf(token);
  return [...store.sessions.entries()]
    .filter(([, s]) => s.userId === userId && s.expiresAt > Date.now())
    .map(([hash, s]) => ({
      id: hash.slice(0, 16),
      current: hash === current,
      device: 'This browser (mock)',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date(s.createdAt).toISOString(),
    }));
}

/* Adapter: in-memory mock (`MOCK_API=true`), token-based like the API. */
export const mockAuthService: AuthService = {
  requestOtp: (phone) => requestOtp(phone),
  verifyOtp: (phone, code) => verifyOtp(phone, code),
  signInWithGoogle: () => mockGoogle(),
  getUser: (token) => getUserBySessionToken(token),
  logout: (token) => deleteSession(token),
  updateProfile: async (token, input) => updateProfile(userIdOf(token), input),
  listAddresses: async (token) => listAddresses(userIdOf(token)),
  saveAddress: async (token, input, id) => saveAddress(userIdOf(token), input, id),
  deleteAddress: async (token, id) => deleteAddress(userIdOf(token), id),
  setDefaultAddress: async (token, id) => setDefaultAddress(userIdOf(token), id),
  listSessions: async (token) => listSessions(token),
  async revokeSession(token, sessionId) {
    const userId = userIdOf(token);
    for (const [hash, s] of store.sessions) {
      if (s.userId === userId && hash.startsWith(sessionId)) store.sessions.delete(hash);
    }
  },
  async revokeOtherSessions(token) {
    const userId = userIdOf(token);
    const current = hashToken(token);
    let count = 0;
    for (const [hash, s] of store.sessions) {
      if (s.userId === userId && hash !== current) {
        store.sessions.delete(hash);
        count += 1;
      }
    }
    return count;
  },
};
