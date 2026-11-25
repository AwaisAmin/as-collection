'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { clientInfo } from '@/lib/api/client-ip';
import { ApiError } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';
import { formatPkMobile } from '@/lib/utils/phone';

import {
  type AddressFormField,
  addressSchema,
  otpCodeSchema,
  personNameSchema,
  pkMobileSchema,
  profileSchema,
} from './schemas';
import { authService } from './services/auth.service';
import { endSession, getCurrentUser, getSessionToken, startSession } from './session';

/* ───────────────────────────── OTP login ───────────────────────────── */

export type RequestOtpState =
  | { ok: true; phone: string; displayPhone: string; resendIn: number; devCode?: string }
  | {
      ok: false;
      error: string;
      /** Seconds until a new code may be requested. */ retryIn?: number;
    };

export async function requestOtpAction(rawPhone: string): Promise<RequestOtpState> {
  const phone = pkMobileSchema.safeParse(rawPhone);
  if (!phone.success) return { ok: false, error: phone.error.issues[0]!.message };

  try {
    const result = await authService.requestOtp(phone.data, await clientInfo());
    if (!result.ok) {
      return {
        ok: false,
        error: `Too many codes requested. Please try again in ${result.retryIn} seconds.`,
        retryIn: result.retryIn,
      };
    }
    return {
      ok: true,
      phone: phone.data,
      displayPhone: formatPkMobile(phone.data),
      resendIn: result.resendIn,
      // Only present when the API echoes codes (OTP_DEV_ECHO), which it refuses in production.
      devCode: result.devCode,
    };
  } catch (error) {
    reportError(error, { action: 'auth.requestOtp' });
    return { ok: false, error: 'We couldn’t send the code right now. Please try again.' };
  }
}

export type VerifyOtpState =
  { ok: true; needsName: boolean } | { ok: false; error: string; restart?: boolean };

export async function verifyOtpAction(rawPhone: string, rawCode: string): Promise<VerifyOtpState> {
  const phone = pkMobileSchema.safeParse(rawPhone);
  const code = otpCodeSchema.safeParse(rawCode);
  if (!phone.success || !code.success) return { ok: false, error: 'Enter the 6-digit code.' };

  let result;
  try {
    result = await authService.verifyOtp(phone.data, code.data, await clientInfo());
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_BLOCKED') {
      return { ok: false, error: error.message, restart: true };
    }
    reportError(error, { action: 'auth.verifyOtp' });
    return { ok: false, error: 'We couldn’t sign you in right now. Please try again.' };
  }
  if (!result.ok) {
    switch (result.reason) {
      case 'invalid':
        return {
          ok: false,
          error: `That code isn’t right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`,
        };
      case 'expired':
        return {
          ok: false,
          error: 'This code has expired. Please request a new one.',
          restart: true,
        };
      default:
        return { ok: false, error: 'Too many attempts. Please request a new code.', restart: true };
    }
  }

  await startSession(result.session);
  return { ok: true, needsName: !result.user.name };
}

export async function completeProfileAction(
  rawName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const token = await getSessionToken();
  if (!user || !token) return { ok: false, error: 'Your session expired. Please sign in again.' };
  const name = personNameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: name.error.issues[0]!.message };
  await authService.updateProfile(token, { name: name.data, email: user.email });
  return { ok: true };
}

const googleCredentialSchema = z.string().min(20).max(4096);

/** Google sign-in: `credential` is the ID token from Google's button (verified by the API). */
export async function googleSignInAction(
  credential: string,
): Promise<{ ok: true; needsName: boolean } | { ok: false; error: string }> {
  const parsed = googleCredentialSchema.safeParse(credential);
  if (!parsed.success) {
    return { ok: false, error: 'Google sign-in failed. Please try again.' };
  }
  try {
    const result = await authService.signInWithGoogle(credential, await clientInfo());
    if (!result.ok) return { ok: false, error: result.error };
    await startSession(result.session);
    return { ok: true, needsName: !result.user.name };
  } catch (error) {
    reportError(error, { action: 'auth.google' });
    return { ok: false, error: 'We couldn’t sign you in with Google right now. Please try again.' };
  }
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/');
}

/* ───────────────────────────── Profile ───────────────────────────── */

export type FormState<F extends string> =
  | { status: 'idle' }
  | { status: 'success'; message: string; at: number }
  | { status: 'error'; message?: string; fieldErrors: Partial<Record<F, string>>; at: number };

function fieldErrors<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as F | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

const signedOut = <F extends string>(): FormState<F> => ({
  status: 'error',
  message: 'Your session expired. Please sign in again.',
  fieldErrors: {},
  at: Date.now(),
});

/** The API's field names → this form's (e.g. `line1` → `address`). */
function apiFailure<F extends string>(
  error: unknown,
  fields: Partial<Record<string, F>>,
  action: string,
): FormState<F> {
  if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
    const mapped: Partial<Record<F, string>> = {};
    for (const [apiField, message] of Object.entries(error.fieldErrors)) {
      const field = fields[apiField];
      if (field) mapped[field] ??= message;
    }
    const message =
      Object.keys(mapped).length > 0
        ? undefined
        : error.status === 401
          ? 'Your session expired. Please sign in again.'
          : error.message;
    return { status: 'error', message, fieldErrors: mapped, at: Date.now() };
  }
  reportError(error, { action });
  return {
    status: 'error',
    message: 'We couldn’t save that right now. Please try again.',
    fieldErrors: {},
    at: Date.now(),
  };
}

export async function updateProfileAction(
  _prev: FormState<'name' | 'email'>,
  formData: FormData,
): Promise<FormState<'name' | 'email'>> {
  const token = await getSessionToken();
  if (!token) return signedOut();
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') ?? '',
  });
  if (!parsed.success)
    return { status: 'error', fieldErrors: fieldErrors(parsed.error), at: Date.now() };
  try {
    await authService.updateProfile(token, {
      name: parsed.data.name,
      email: parsed.data.email || undefined,
    });
  } catch (error) {
    return apiFailure(error, { name: 'name', email: 'email' }, 'account.profile');
  }
  refresh();
  return { status: 'success', message: 'Profile updated.', at: Date.now() };
}

/* ───────────────────────────── Address book ───────────────────────────── */

const addressIdSchema = z.uuid();

const ADDRESS_FIELDS: Partial<Record<string, AddressFormField>> = {
  label: 'label',
  fullName: 'recipientName',
  phone: 'phone',
  line1: 'address',
  city: 'city',
  postalCode: 'postalCode',
};

export async function saveAddressAction(
  _prev: FormState<AddressFormField>,
  formData: FormData,
): Promise<FormState<AddressFormField>> {
  const token = await getSessionToken();
  if (!token) return signedOut();

  const parsed = addressSchema.safeParse({
    label: formData.get('label'),
    recipientName: formData.get('recipientName'),
    phone: formData.get('phone'),
    city: formData.get('city'),
    address: formData.get('address'),
    postalCode: formData.get('postalCode') ?? '',
    isDefault: formData.get('isDefault') === 'on',
  });
  if (!parsed.success)
    return { status: 'error', fieldErrors: fieldErrors(parsed.error), at: Date.now() };

  const rawId = String(formData.get('addressId') ?? '');
  const addressId = rawId && addressIdSchema.safeParse(rawId).success ? rawId : undefined;
  try {
    await authService.saveAddress(
      token,
      { ...parsed.data, postalCode: parsed.data.postalCode || undefined },
      addressId,
    );
  } catch (error) {
    return apiFailure(error, ADDRESS_FIELDS, 'account.address.save');
  }
  refresh();
  return {
    status: 'success',
    message: addressId ? 'Address updated.' : 'Address added.',
    at: Date.now(),
  };
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token || !addressIdSchema.safeParse(addressId).success) return;
  await authService.deleteAddress(token, addressId);
  refresh();
}

export async function setDefaultAddressAction(addressId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token || !addressIdSchema.safeParse(addressId).success) return;
  await authService.setDefaultAddress(token, addressId);
  refresh();
}

/* ───────────────────────────── Signed-in devices ───────────────────────────── */

const sessionIdSchema = z.string().min(1).max(64);

export async function revokeSessionAction(sessionId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token || !sessionIdSchema.safeParse(sessionId).success) return;
  try {
    await authService.revokeSession(token, sessionId);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  refresh();
}

export async function revokeOtherSessionsAction(): Promise<{ revoked: number }> {
  const token = await getSessionToken();
  if (!token) return { revoked: 0 };
  const revoked = await authService.revokeOtherSessions(token);
  refresh();
  return { revoked };
}
