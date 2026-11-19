'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { serverEnv } from '@/config/env.server';
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
import { endSession, getCurrentUser, startSession } from './session';

/* ───────────────────────────── OTP login ───────────────────────────── */

export type RequestOtpState =
  | { ok: true; phone: string; displayPhone: string; resendIn: number; devCode?: string }
  | { ok: false; error: string };

export async function requestOtpAction(rawPhone: string): Promise<RequestOtpState> {
  const phone = pkMobileSchema.safeParse(rawPhone);
  if (!phone.success) return { ok: false, error: phone.error.issues[0]!.message };

  try {
    const result = await authService.requestOtp(phone.data);
    if (!result.ok) {
      return {
        ok: false,
        error: `Too many codes requested. Please try again in ${result.retryIn} seconds.`,
      };
    }
    return {
      ok: true,
      phone: phone.data,
      displayPhone: formatPkMobile(phone.data),
      resendIn: result.resendIn,
      // The code is only ever returned while running on mocks (local development).
      devCode: serverEnv.MOCK_API ? result.devCode : undefined,
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

  const result = await authService.verifyOtp(phone.data, code.data);
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

  await startSession(result.user.id);
  return { ok: true, needsName: !result.user.name };
}

export async function completeProfileAction(
  rawName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' };
  const name = personNameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: name.error.issues[0]!.message };
  await authService.updateProfile(user.id, { name: name.data, email: user.email });
  return { ok: true };
}

/** Mock Google sign-in. The real flow (OAuth redirect + callback) is wired with the API. */
export async function googleSignInAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!serverEnv.MOCK_API) return { ok: false, error: 'Google sign-in is not configured yet.' };
  const user = await authService.signInWithGoogle({
    googleId: 'mock-google-001',
    email: 'demo.customer@gmail.com',
    name: 'Demo Google Customer',
  });
  await startSession(user.id);
  return { ok: true };
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

export async function updateProfileAction(
  _prev: FormState<'name' | 'email'>,
  formData: FormData,
): Promise<FormState<'name' | 'email'>> {
  const user = await getCurrentUser();
  if (!user)
    return { status: 'error', message: 'Please sign in again.', fieldErrors: {}, at: Date.now() };
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') ?? '',
  });
  if (!parsed.success)
    return { status: 'error', fieldErrors: fieldErrors(parsed.error), at: Date.now() };
  await authService.updateProfile(user.id, {
    name: parsed.data.name,
    email: parsed.data.email || undefined,
  });
  refresh();
  return { status: 'success', message: 'Profile updated.', at: Date.now() };
}

/* ───────────────────────────── Address book ───────────────────────────── */

const addressIdSchema = z.uuid();

export async function saveAddressAction(
  _prev: FormState<AddressFormField>,
  formData: FormData,
): Promise<FormState<AddressFormField>> {
  const user = await getCurrentUser();
  if (!user)
    return { status: 'error', message: 'Please sign in again.', fieldErrors: {}, at: Date.now() };

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
  await authService.saveAddress(
    user.id,
    { ...parsed.data, postalCode: parsed.data.postalCode || undefined },
    addressId,
  );
  refresh();
  return {
    status: 'success',
    message: addressId ? 'Address updated.' : 'Address added.',
    at: Date.now(),
  };
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !addressIdSchema.safeParse(addressId).success) return;
  await authService.deleteAddress(user.id, addressId);
  refresh();
}

export async function setDefaultAddressAction(addressId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !addressIdSchema.safeParse(addressId).success) return;
  await authService.setDefaultAddress(user.id, addressId);
  refresh();
}
