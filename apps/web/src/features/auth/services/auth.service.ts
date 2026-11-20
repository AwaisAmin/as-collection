import 'server-only';

import { serverEnv } from '@/config/env.server';

import type {
  Address,
  AddressInput,
  ClientContext,
  DeviceSession,
  GoogleSignInResult,
  RequestOtpResult,
  User,
  VerifyOtpResult,
} from '../types';
import { apiAuthService } from './auth.api';
import { mockAuthService } from './auth.mock';

/**
 * Port: sign-in and the customer's account. Everything after sign-in is addressed by the
 * session token (kept in our HttpOnly cookie), never by a user id the browser could send.
 */
export interface AuthService {
  requestOtp(phone: string, client: ClientContext): Promise<RequestOtpResult>;
  verifyOtp(phone: string, code: string, client: ClientContext): Promise<VerifyOtpResult>;
  /** `credential`: the Google ID token from Google's sign-in button. */
  signInWithGoogle(credential: string, client: ClientContext): Promise<GoogleSignInResult>;
  /** The signed-in customer, or null when the session is unknown, expired or revoked. */
  getUser(token: string): Promise<User | null>;
  logout(token: string): Promise<void>;
  updateProfile(token: string, input: { name: string; email?: string }): Promise<User>;
  listAddresses(token: string): Promise<Address[]>;
  saveAddress(token: string, input: AddressInput, addressId?: string): Promise<Address>;
  deleteAddress(token: string, addressId: string): Promise<void>;
  setDefaultAddress(token: string, addressId: string): Promise<void>;
  listSessions(token: string): Promise<DeviceSession[]>;
  revokeSession(token: string, sessionId: string): Promise<void>;
  /** Signs out every other device; returns how many. */
  revokeOtherSessions(token: string): Promise<number>;
}

/** The NestJS API, or in-memory mocks for offline development (`MOCK_API=true`). */
export const authService: AuthService = serverEnv.MOCK_API ? mockAuthService : apiAuthService;
