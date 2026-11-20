import 'server-only';

import type {
  AddressDto,
  CustomerDto,
  LoginResultDto,
  OtpRequestResultDto,
  SessionInfoDto,
  SessionSummaryDto,
} from '@as/contracts';

import { ApiError, apiRequest } from '@/lib/api/http-client';

import { toAddress, toAddressBody, toUser } from '../lib/auth-mappers';
import { describeDevice } from '../lib/device';
import type { ClientContext, DeviceSession, SignInSuccess, VerifyOtpResult } from '../types';
import type { AuthService } from './auth.service';

/* Adapter: the NestJS customer-auth and account API (bearer token from our HttpOnly cookie). */

const toSignIn = (dto: LoginResultDto): SignInSuccess => ({
  ok: true,
  user: toUser(dto.customer),
  isNew: dto.isNew,
  session: { token: dto.token, expiresAt: new Date(dto.expiresAt) },
});

const extension = (error: ApiError, key: string) => {
  const value = error.problem?.[key];
  return typeof value === 'number' ? value : undefined;
};

const asClient = (client: ClientContext) => ({ clientIp: client.ip, userAgent: client.userAgent });

const isSignedOut = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

export const apiAuthService: AuthService = {
  async requestOtp(phone, client) {
    try {
      const result = await apiRequest<OtpRequestResultDto>('/auth/otp', {
        method: 'POST',
        body: { phone },
        ...asClient(client),
      });
      return {
        ok: true,
        resendIn: result.resendInSeconds,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        return {
          ok: false,
          reason: 'rate_limited',
          retryIn: extension(error, 'retryAfterSeconds') ?? 60,
        };
      }
      throw error;
    }
  },

  async verifyOtp(phone, code, client): Promise<VerifyOtpResult> {
    try {
      return toSignIn(
        await apiRequest<LoginResultDto>('/auth/otp/verify', {
          method: 'POST',
          body: { phone, code },
          ...asClient(client),
        }),
      );
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      switch (error.code) {
        case 'OTP_INVALID':
          return {
            ok: false,
            reason: 'invalid',
            attemptsLeft: extension(error, 'attemptsLeft') ?? 0,
          };
        case 'OTP_EXPIRED':
          return { ok: false, reason: 'expired' };
        case 'OTP_TOO_MANY_ATTEMPTS':
          return { ok: false, reason: 'too_many_attempts' };
        case 'OTP_NOT_REQUESTED':
          return { ok: false, reason: 'no_challenge' };
        default:
          throw error;
      }
    }
  },

  async signInWithGoogle(credential, client) {
    try {
      return toSignIn(
        await apiRequest<LoginResultDto>('/auth/google', {
          method: 'POST',
          body: { idToken: credential },
          ...asClient(client),
        }),
      );
    } catch (error) {
      // Invalid token, blocked account, Google disabled: show the API's explanation.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
  },

  async getUser(token) {
    try {
      return toUser((await apiRequest<SessionInfoDto>('/auth/session', { token })).customer);
    } catch (error) {
      if (isSignedOut(error)) return null;
      throw error;
    }
  },

  async logout(token) {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST', token });
    } catch (error) {
      if (!isSignedOut(error)) throw error;
    }
  },

  async updateProfile(token, input) {
    return toUser(
      await apiRequest<CustomerDto>('/account', {
        method: 'PATCH',
        body: { name: input.name, email: input.email ?? null },
        token,
      }),
    );
  },

  async listAddresses(token) {
    return (await apiRequest<AddressDto[]>('/account/addresses', { token })).map(toAddress);
  },

  async saveAddress(token, input, addressId) {
    const body = toAddressBody(input);
    const dto = addressId
      ? await apiRequest<AddressDto>(`/account/addresses/${encodeURIComponent(addressId)}`, {
          method: 'PATCH',
          body,
          token,
        })
      : await apiRequest<AddressDto>('/account/addresses', { method: 'POST', body, token });
    return toAddress(dto);
  },

  async deleteAddress(token, addressId) {
    await apiRequest<void>(`/account/addresses/${encodeURIComponent(addressId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async setDefaultAddress(token, addressId) {
    await apiRequest<AddressDto>(`/account/addresses/${encodeURIComponent(addressId)}`, {
      method: 'PATCH',
      body: { isDefault: true },
      token,
    });
  },

  async listSessions(token): Promise<DeviceSession[]> {
    const rows = await apiRequest<SessionSummaryDto[]>('/account/sessions', { token });
    return rows.map((s) => ({
      id: s.id,
      current: s.current,
      device: describeDevice(s.userAgent),
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
    }));
  },

  async revokeSession(token, sessionId) {
    await apiRequest<void>(`/account/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async revokeOtherSessions(token) {
    const result = await apiRequest<{ revoked: number }>('/account/sessions/revoke-others', {
      method: 'POST',
      token,
    });
    return result.revoked;
  },
};
