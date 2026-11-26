import 'server-only';

import type { ProblemDetails } from '@as/contracts';

import { env } from '@/config/env';

/** Typed error for any non-2xx response or transport failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Stable machine-readable code from the API (`OUT_OF_STOCK`, `VALIDATION_FAILED`, …). */
    readonly code: string = 'UNKNOWN',
    /** The full RFC 9457 problem, when the API sent one (field `errors`, extensions…). */
    readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Per-field messages of a 422, keyed by the first path segment (`email`, `lines`…). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { path, message } of this.problem?.errors ?? []) {
      const key = path.split('.')[0] ?? path;
      out[key] ??= message;
    }
    return out;
  }
}

type QueryValue = string | number | boolean | readonly (string | number)[] | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Appended as a query string; empty values are skipped, arrays become comma lists. */
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Shopper's IP, forwarded so the API's per-IP abuse limits see the real client. */
  clientIp?: string | null;
  /** Shopper's browser, forwarded so "signed-in devices" names their device. */
  userAgent?: string | null;
  /** Customer session (the API bearer token kept in our HttpOnly cookie). */
  token?: string | null;
  timeoutMs?: number;
}

export function buildQuery(query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      continue;
    }
    params.set(key, value === true ? '1' : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const isProblem = (value: unknown): value is ProblemDetails =>
  typeof value === 'object' && value !== null && 'code' in value && 'status' in value;

/**
 * Server-side fetch for the NestJS API: base URL, JSON, timeout, typed errors. Responses are the
 * resource itself (no envelope); errors are RFC 9457 problems. Callers cache with
 * `'use cache'`, so the transport itself never caches.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    headers,
    clientIp,
    userAgent,
    token,
    timeoutMs = env.API_TIMEOUT_MS,
  } = options;
  const url = `${env.API_URL}${path}${buildQuery(query)}`;
  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  const isMultipart = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isMultipart ? { 'Content-Type': 'application/json' } : {}),
        ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
        ...(userAgent ? { 'User-Agent': userAgent.slice(0, 512) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new ApiError(
      timedOut ? 'The store is taking too long to respond.' : 'Could not reach the store.',
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isProblem(payload)) {
      const problem = payload.errors
        ? {
            ...payload,
            // Field messages are written to follow the field name ("must be after the start");
            // under a form field they read as a sentence.
            errors: payload.errors.map((e) => ({ ...e, message: sentence(e.message) })),
          }
        : payload;
      throw new ApiError(payload.detail || payload.title, response.status, payload.code, problem);
    }
    throw new ApiError(response.statusText || 'Request failed', response.status);
  }
  return payload as T;
}

/** `null` for 404, otherwise the response (other errors are thrown). */
export async function apiFindOrNull<T>(path: string, options?: RequestOptions): Promise<T | null> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
