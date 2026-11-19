import { ConsoleLogger, type LogLevel } from '@nestjs/common';

import { type Env, logLevels } from '../../config/env.js';

/** Keys whose values are masked in structured log params. */
export const REDACTED_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
] as const;

/** `warn` → ['warn', 'error', 'fatal']: the chosen level and everything more severe. */
export function levelsFrom(min: Env['LOG_LEVEL']): LogLevel[] {
  return logLevels.slice(logLevels.indexOf(min));
}

/**
 * JSON lines in production (one object per line, for log shippers); colourful text locally.
 * Secrets in structured params are replaced with "[REDACTED]".
 */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): ConsoleLogger {
  const production = env.NODE_ENV === 'production';
  return new ConsoleLogger({
    json: production,
    colors: !production && env.NODE_ENV !== 'test',
    logLevels: levelsFrom(env.LOG_LEVEL),
    redact: [...REDACTED_KEYS],
  });
}
