import 'server-only';

import { serverEnv } from '@/config/env.server';

import type { ApiErrorBody, ApiSuccess } from './types';

/** Typed error for any non-2xx response or transport failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'UNKNOWN',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

/**
 * Server-side fetch wrapper for the NestJS API: base URL, JSON, timeout, typed errors.
 * Unwraps the `{ data }` envelope.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = serverEnv.API_TIMEOUT_MS } = options;
  const url = `${serverEnv.API_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new ApiError(
      timedOut ? 'Request timed out' : 'Network error',
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      cause,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isErrorBody(payload)) {
      const { code, message, details } = payload.error;
      throw new ApiError(message, response.status, code, details);
    }
    throw new ApiError(response.statusText || 'Request failed', response.status);
  }

  return (payload as ApiSuccess<T>).data;
}
