import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { NodeRequest } from '@nestjs/platform-node';

import { DomainException } from '../../common/http/problem-details.js';
import { type AuthSession, type ClientInfo, SessionService } from './session.service.js';

type AuthenticatedRequest = NodeRequest & { auth?: AuthSession };

/** `Authorization: Bearer <token>` → the token, or null. */
export function bearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export const unauthenticated = () =>
  new DomainException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please sign in to continue.', {
    headers: { 'WWW-Authenticate': 'Bearer' },
  });

/** Requires a valid customer session; exposes it through `@CurrentSession()`. */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(req.headers.authorization);
    const session = token ? await this.sessions.resolve(token) : null;
    if (!session) throw unauthenticated();
    req.auth = session;
    return true;
  }
}

/**
 * Attaches the session when a valid bearer token is sent, and lets the request through as a guest
 * otherwise (a stale cookie must not break guest checkout). Read it with `@OptionalSession()`.
 */
@Injectable()
export class OptionalCustomerAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(req.headers.authorization);
    const session = token ? await this.sessions.resolve(token) : null;
    if (session) req.auth = session;
    return true;
  }
}

export const OptionalSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthSession | null =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth ?? null,
);

/** The session `CustomerAuthGuard` attached. Only valid on guarded routes. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthSession => {
    const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!auth) throw unauthenticated();
    return auth;
  },
);

/** Client IP (via trusted proxies only, see TRUST_PROXY) and user agent, for sessions/limits. */
export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const req = context.switchToHttp().getRequest<NodeRequest>();
    const userAgent = req.headers['user-agent'];
    return { ip: req.ip ?? null, userAgent: typeof userAgent === 'string' ? userAgent : null };
  },
);
