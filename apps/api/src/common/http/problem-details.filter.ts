import type { IncomingMessage, ServerResponse } from 'node:http';

import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';

import { currentRequestId } from '../request-context.js';
import { DomainException, toProblemDetails } from './problem-details.js';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';
import { requestPath } from './request-path.js';

/**
 * Global exception filter: every error leaves the API as `application/problem+json`.
 * 5xx errors are logged with their stack and request id; their internals reach the client only
 * outside production.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly exposeInternalErrors: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const http = host.switchToHttp();
    const req = http.getRequest<IncomingMessage>();
    const res = http.getResponse<ServerResponse>();

    const requestId =
      currentRequestId() ?? (res.getHeader(REQUEST_ID_HEADER) as string | undefined);
    const problem = toProblemDetails(exception, {
      instance: requestPath(req),
      requestId,
      exposeInternalErrors: this.exposeInternalErrors,
    });

    if (problem.status >= 500) {
      this.logger.error(
        `${req.method ?? ''} ${problem.instance ?? ''} failed`,
        exception instanceof Error ? exception.stack : String(exception),
        { requestId },
      );
    }

    if (res.headersSent) {
      res.end();
      return;
    }
    res.statusCode = problem.status;
    res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (exception instanceof DomainException) {
      for (const [name, value] of Object.entries(exception.headers)) res.setHeader(name, value);
    }
    res.end(JSON.stringify(problem));
  }
}
