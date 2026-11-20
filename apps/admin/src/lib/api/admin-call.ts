import 'server-only';

import type { SaveState } from '@/lib/action-state';
import { requireStaff } from '@/lib/session';

import { clientInfo } from './client-ip';
import { ApiError, apiRequest, type RequestOptions } from './http-client';

/** An admin API call as the signed-in staff member (token, client IP and browser forwarded). */
export async function adminCall<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token } = await requireStaff();
  const { ip, userAgent } = await clientInfo();
  return apiRequest<T>(path, { ...options, token, clientIp: ip, userAgent });
}

const MAX_PAYLOAD_CHARS = 200_000;

/** The `payload` field of a JSON editor form, if it is a reasonably sized JSON object. */
export function parsePayload(formData: FormData): Record<string, unknown> | null {
  const raw = formData.get('payload');
  if (typeof raw !== 'string' || raw.length > MAX_PAYLOAD_CHARS) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A failed save as the editor shows it: field errors by path, stale saves, plain messages. */
export function saveFailure(error: unknown): SaveState {
  const at = Date.now();
  if (error instanceof ApiError) {
    if (error.code === 'STALE_UPDATE') return { stale: true, error: error.message, at };
    if (error.status === 422 && error.problem?.errors?.length) {
      const errors: Record<string, string> = {};
      for (const { path, message } of error.problem.errors) errors[path] ??= message;
      return { error: 'Some fields need attention.', errors, at };
    }
    if (error.status === 403) return { error: 'Your role does not allow this.', at };
    if (error.status === 413) return { error: 'That file is too large (20 MB at most).', at };
    if (error.status >= 400 && error.status < 500) return { error: error.message, at };
  }
  return { error: 'Could not save right now. Please try again.', at };
}
