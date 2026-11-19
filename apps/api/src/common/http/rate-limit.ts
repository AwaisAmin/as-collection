import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const STRICT_RATE_LIMIT = 'as:strict-rate-limit';
const reflector = new Reflector();

/**
 * Adds the `strict` throttler (AUTH_RATE_LIMIT_MAX per minute per IP) on top of the default one.
 * For routes attackers hammer: sign-in, code verification, password-like secrets.
 */
export const StrictRateLimit = () => SetMetadata(STRICT_RATE_LIMIT, true);

export const isStrictRateLimited = (context: ExecutionContext): boolean =>
  reflector.getAllAndOverride<boolean | undefined>(STRICT_RATE_LIMIT, [
    context.getHandler(),
    context.getClass(),
  ]) === true;
