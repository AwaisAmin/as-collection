'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { z } from 'zod';

import { clientInfo } from '@/lib/api/client-ip';
import { ApiError, apiRequest } from '@/lib/api/http-client';
import { endSession, getSessionToken, startSession } from '@/lib/session';

import { safeNextPath } from './safe-next';

/*
 * Staff sign-in, step by step: email + password → authenticator code (or, the first time,
 * setting up the authenticator) → session cookie. The short-lived challenge token between steps
 * is signed by the API and bound to the account's current password.
 */

export type LoginState =
  | { step: 'credentials'; error?: string; email?: string }
  | { step: 'code'; challengeToken: string; error?: string }
  | {
      step: 'enrol';
      challengeToken: string;
      /** For typing into the authenticator app when the QR code can't be scanned. */
      secret: string;
      qrSvg: string;
      error?: string;
    };

interface SessionResult {
  token: string;
  staff: { mustChangePassword: boolean };
}

type LoginResult =
  | { status: 'TOTP_REQUIRED' | 'TOTP_ENROLMENT_REQUIRED'; challengeToken: string }
  | ({ status: 'AUTHENTICATED' } & SessionResult);

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter your work email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(256),
});
const codeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'));

async function withClient() {
  const { ip, userAgent } = await clientInfo();
  return { clientIp: ip, userAgent };
}

/** Starts the session and leaves the login page (password change first if required). */
async function signIn(result: SessionResult, next: string): Promise<never> {
  await startSession(result.token);
  redirect((result.staff.mustChangePassword ? '/change-password' : next) as Route);
}

async function enrolment(challengeToken: string): Promise<LoginState> {
  const { secret, otpauthUri } = await apiRequest<{ secret: string; otpauthUri: string }>(
    '/admin/auth/totp/enrol',
    { method: 'POST', body: { challengeToken }, ...(await withClient()) },
  );
  const qrSvg = await QRCode.toString(otpauthUri, { type: 'svg', margin: 1, width: 208 });
  return { step: 'enrol', challengeToken, secret, qrSvg };
}

function failure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
    if (error.status >= 400 && error.status < 500) return error.message;
  }
  return 'Sign-in is unavailable right now. Please try again shortly.';
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNextPath(formData.get('next'));

  if (prev.step === 'credentials') {
    const parsed = credentialsSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });
    if (!parsed.success) {
      return {
        step: 'credentials',
        error: parsed.error.issues[0]?.message,
        email: String(formData.get('email') ?? ''),
      };
    }
    let result: LoginResult;
    try {
      result = await apiRequest<LoginResult>('/admin/auth/login', {
        method: 'POST',
        body: parsed.data,
        ...(await withClient()),
      });
      if (result.status === 'TOTP_ENROLMENT_REQUIRED')
        return await enrolment(result.challengeToken);
    } catch (error) {
      return { step: 'credentials', error: failure(error), email: parsed.data.email };
    }
    if (result.status !== 'AUTHENTICATED') {
      return { step: 'code', challengeToken: result.challengeToken };
    }
    return signIn(result, next);
  }

  // Code step (authenticator set up already, or being set up now).
  const code = codeSchema.safeParse(formData.get('code') ?? '');
  if (!code.success) return { ...prev, error: code.error.issues[0]?.message };
  let session: SessionResult;
  try {
    session = await apiRequest<SessionResult>('/admin/auth/totp/verify', {
      method: 'POST',
      body: { challengeToken: prev.challengeToken, code: code.data },
      ...(await withClient()),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CHALLENGE_EXPIRED') {
      return { step: 'credentials', error: error.message };
    }
    return { ...prev, error: failure(error) };
  }
  return signIn(session, next);
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/login' as Route);
}

export type PasswordState = {
  error?: string;
  fieldErrors?: { current?: string; next?: string; confirm?: string };
};

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.').max(256),
    next: z.string().min(12, 'Use at least 12 characters.').max(128, 'Use at most 128 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match.',
  })
  .refine((v) => v.next !== v.current, { path: ['next'], message: 'Choose a different password.' });

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const token = await getSessionToken();
  if (!token) redirect('/login' as Route);
  const parsed = passwordSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    const fieldErrors: NonNullable<PasswordState['fieldErrors']> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  try {
    await apiRequest<void>('/admin/auth/password', {
      method: 'POST',
      body: { currentPassword: parsed.data.current, newPassword: parsed.data.next },
      token,
      ...(await withClient()),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'WEAK_PASSWORD') {
      return { fieldErrors: { next: error.message } };
    }
    if (error instanceof ApiError && error.status === 422) {
      return { fieldErrors: { next: error.fieldErrors.newPassword ?? error.message } };
    }
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
      return { fieldErrors: { current: 'Your current password is not correct.' } };
    }
    return { error: failure(error) };
  }
  // Other devices were signed out; this one continues.
  redirect('/?password=changed' as Route);
}
