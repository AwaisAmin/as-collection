import { STATUS_CODES } from 'node:http';

import { HttpException, HttpStatus } from '@nestjs/common';

/** One invalid field, e.g. `{ path: 'items.0.quantity', message: 'Too small: expected >= 1' }`. */
export interface FieldError {
  path: string;
  message: string;
}

/**
 * RFC 9457 "Problem Details" — the single error format of this API
 * (`Content-Type: application/problem+json`). `code` is stable and machine-readable;
 * `title`/`detail` are for humans and may change.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: FieldError[];
}

/** Thrown by the global validation pipe; rendered as 422 with per-field `errors`. */
export class ValidationFailedException extends HttpException {
  constructor(readonly errors: FieldError[]) {
    super(
      { message: 'The request contains invalid fields.', errors },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Base class for business errors with a stable `code`, e.g.
 * `throw new DomainException(HttpStatus.CONFLICT, 'OUT_OF_STOCK', 'Only 2 left in stock.')`.
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    detail: string,
  ) {
    super({ message: detail }, status);
  }
}

const codeByStatus: Partial<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const titleFor = (status: number) => STATUS_CODES[status] ?? 'Error';
const codeFor = (status: number) =>
  codeByStatus[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');

function messageOf(response: unknown): string | undefined {
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const { message } = response;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('; ');
  }
  return undefined;
}

/** Prisma "known request" errors, matched structurally so this module stays ORM-agnostic. */
interface PrismaKnownError {
  name: 'PrismaClientKnownRequestError';
  code: string;
}

const isPrismaKnownError = (error: unknown): error is PrismaKnownError =>
  error instanceof Error &&
  error.name === 'PrismaClientKnownRequestError' &&
  typeof (error as Partial<PrismaKnownError>).code === 'string';

/** Database errors that are the client's fault, not ours. Everything else stays a 500. */
const prismaProblems: Record<string, { status: number; code: string; detail: string }> = {
  P2002: {
    status: 409,
    code: 'ALREADY_EXISTS',
    detail: 'A record with these details already exists.',
  },
  P2025: { status: 404, code: 'NOT_FOUND', detail: 'The requested record does not exist.' },
};

interface ToProblemOptions {
  instance?: string;
  requestId?: string;
  /** Include internal error messages for 5xx (never in production). */
  exposeInternalErrors: boolean;
}

/** Maps anything thrown inside a request to Problem Details. Unknown errors become a generic 500. */
export function toProblemDetails(exception: unknown, options: ToProblemOptions): ProblemDetails {
  const base = { type: 'about:blank', instance: options.instance, requestId: options.requestId };

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const problem: ProblemDetails = {
      ...base,
      title: titleFor(status),
      status,
      code: exception instanceof DomainException ? exception.code : codeFor(status),
      detail: messageOf(exception.getResponse()),
    };
    if (exception instanceof ValidationFailedException) problem.errors = exception.errors;
    // Nest's built-in 5xx exceptions can carry internal details too.
    if (status >= 500 && !options.exposeInternalErrors) delete problem.detail;
    return problem;
  }

  if (isPrismaKnownError(exception)) {
    const known = prismaProblems[exception.code];
    if (known) return { ...base, title: titleFor(known.status), ...known };
  }

  return {
    ...base,
    title: titleFor(500),
    status: 500,
    code: 'INTERNAL_ERROR',
    detail:
      options.exposeInternalErrors && exception instanceof Error
        ? exception.message
        : 'Something went wrong on our side. Please try again.',
  };
}
