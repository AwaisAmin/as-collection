/**
 * API response envelope shared with the NestJS backend.
 * (Will move to `packages/shared` when the API is added.)
 */
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
