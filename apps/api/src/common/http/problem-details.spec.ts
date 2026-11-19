import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import {
  DomainException,
  RateLimitedException,
  toProblemDetails,
  ValidationFailedException,
} from './problem-details.js';
import { formatIssuePath } from './validation.js';

const opts = { instance: '/api/v1/x', requestId: 'req-12345678', exposeInternalErrors: false };

describe('toProblemDetails', () => {
  it('maps Nest HTTP exceptions with a stable code', () => {
    expect(toProblemDetails(new NotFoundException('Product not found'), opts)).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Product not found',
      instance: '/api/v1/x',
      requestId: 'req-12345678',
    });
  });

  it('includes field errors for validation failures', () => {
    const errors = [{ path: 'email', message: 'Invalid email address' }];
    const problem = toProblemDetails(new ValidationFailedException(errors), opts);
    expect(problem).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', errors });
  });

  it('keeps the code of domain errors', () => {
    const problem = toProblemDetails(
      new DomainException(HttpStatus.CONFLICT, 'OUT_OF_STOCK', 'Only 2 left.'),
      opts,
    );
    expect(problem).toMatchObject({ status: 409, code: 'OUT_OF_STOCK', detail: 'Only 2 left.' });
  });

  it('adds extension members but never lets them overwrite standard members', () => {
    const error = new DomainException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Wrong code.', {
      extensions: { attemptsLeft: 2, status: 200, code: 'HACKED' },
    });
    expect(toProblemDetails(error, opts)).toMatchObject({
      status: 400,
      code: 'OTP_INVALID',
      attemptsLeft: 2,
    });
  });

  it('carries Retry-After for rate-limited domain errors', () => {
    const error = new RateLimitedException('OTP_RATE_LIMITED', 'Wait a moment.', 12.2);
    expect(error.headers).toEqual({ 'Retry-After': '13' });
    expect(toProblemDetails(error, opts)).toMatchObject({ status: 429, retryAfterSeconds: 13 });
  });

  it('marks rate limiting as RATE_LIMITED', () => {
    expect(toProblemDetails(new ThrottlerException(), opts)).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('maps Prisma unique-constraint and not-found errors without leaking details', () => {
    const prismaError = (code: string) =>
      Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
        name: 'PrismaClientKnownRequestError',
        code,
      });
    expect(toProblemDetails(prismaError('P2002'), opts)).toMatchObject({
      status: 409,
      code: 'ALREADY_EXISTS',
    });
    expect(toProblemDetails(prismaError('P2025'), opts)).toMatchObject({ status: 404 });
    const other = toProblemDetails(prismaError('P2010'), opts);
    expect(other.status).toBe(500);
    expect(other.detail).not.toContain('email');
  });

  it('never leaks internal error messages in production', () => {
    const problem = toProblemDetails(new Error('connect ECONNREFUSED 10.0.0.5:5432'), opts);
    expect(problem.status).toBe(500);
    expect(problem.detail).not.toContain('ECONNREFUSED');
  });

  it('shows internal messages only when explicitly allowed (development)', () => {
    const problem = toProblemDetails(new Error('boom'), { ...opts, exposeInternalErrors: true });
    expect(problem.detail).toBe('boom');
  });
});

describe('formatIssuePath', () => {
  it('joins keys, indexes and path segments', () => {
    expect(formatIssuePath(['items', 0, { key: 'qty' }])).toBe('items.0.qty');
    expect(formatIssuePath([])).toBe('(root)');
    expect(formatIssuePath(undefined)).toBe('(root)');
  });
});
