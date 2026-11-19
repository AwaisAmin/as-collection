import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';

import { runWithRequestContext } from '../request-context.js';
import { requestPath } from './request-path.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Accept a caller's id (e.g. from the Next.js server or a load balancer) only if it is safe to log. */
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Health probes run every few seconds; logging them would drown real traffic. */
const QUIET_PATHS = /^\/api\/health(\/|$)/;

/**
 * Gives every request an id (echoed in the `X-Request-Id` response header and in error bodies),
 * runs the request inside that context, and writes one structured access-log line when it ends.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = process.hrtime.bigint();
    res.once('finish', () => {
      const path = requestPath(req);
      if (QUIET_PATHS.test(path) && res.statusCode < 400) return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const entry = {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      };
      const line = `${req.method ?? ''} ${path} ${res.statusCode}`;
      if (res.statusCode >= 500) this.logger.error(line, entry);
      else if (res.statusCode >= 400) this.logger.warn(line, entry);
      else this.logger.log(line, entry);
    });

    runWithRequestContext({ requestId }, next);
  }
}
