import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NodeRequest } from '@nestjs/platform-node';
import { ApiBearerAuth } from '@nestjs/swagger';

import { DomainException } from '../../common/http/problem-details.js';
import type { AuditActor } from '../audit/audit.service.js';
import { bearerToken } from '../auth/customer-auth.guard.js';
import { hasPermission, type Permission } from './permissions.js';
import { type StaffPrincipal, StaffSessionService } from './staff-session.service.js';

type StaffRequest = NodeRequest & { staff?: StaffPrincipal };

const PERMISSIONS_KEY = 'staff:permissions';
const PASSWORD_CHANGE_OK_KEY = 'staff:password-change-ok';
const ANY_OF_KEY = 'staff:any-of';

/** Marker for routes any signed-in staff member may use (no specific permission). */
const ANY_STAFF = Symbol('any-staff');

/**
 * Admin route protection, deny-by-default: the route needs a valid staff session AND every
 * listed permission. `Staff()` with no arguments means "any signed-in staff member".
 */
export const Staff = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions.length ? permissions : [ANY_STAFF]),
    UseGuards(StaffAuthGuard),
    ApiBearerAuth(),
  );

/** Like `Staff`, but one of the listed permissions is enough. */
export const StaffAnyOf = (...permissions: [Permission, Permission, ...Permission[]]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, [ANY_STAFF]),
    SetMetadata(ANY_OF_KEY, permissions),
    UseGuards(StaffAuthGuard),
    ApiBearerAuth(),
  );

/** Allowed while the staff member still has to replace a temporary password. */
export const AllowPendingPasswordChange = () => SetMetadata(PASSWORD_CHANGE_OK_KEY, true);

export const staffUnauthenticated = () =>
  new DomainException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please sign in to continue.', {
    headers: { 'WWW-Authenticate': 'Bearer' },
  });

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: StaffSessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      (Permission | typeof ANY_STAFF)[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    // A guarded route without a declaration is a programming error: refuse rather than allow.
    if (!required?.length) throw forbidden();

    const req = context.switchToHttp().getRequest<StaffRequest>();
    const token = bearerToken(req.headers.authorization);
    const staff = token ? await this.sessions.resolve(token) : null;
    if (!staff) throw staffUnauthenticated();

    const passwordChangeOk = this.reflector.getAllAndOverride<boolean | undefined>(
      PASSWORD_CHANGE_OK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (staff.mustChangePassword && !passwordChangeOk) {
      throw new DomainException(
        HttpStatus.FORBIDDEN,
        'PASSWORD_CHANGE_REQUIRED',
        'Please choose a new password before continuing.',
      );
    }
    for (const permission of required) {
      if (permission !== ANY_STAFF && !hasPermission(staff.permissions, permission)) {
        throw forbidden();
      }
    }
    const anyOf = this.reflector.getAllAndOverride<Permission[] | undefined>(ANY_OF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (anyOf && !anyOf.some((permission) => hasPermission(staff.permissions, permission))) {
      throw forbidden();
    }
    req.staff = staff;
    return true;
  }
}

const forbidden = () =>
  new DomainException(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'You do not have permission to do this. Ask an administrator for access.',
  );

/** The staff member `StaffAuthGuard` resolved. */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffPrincipal => {
    const { staff } = context.switchToHttp().getRequest<StaffRequest>();
    if (!staff) throw staffUnauthenticated();
    return staff;
  },
);

/** Audit actor for the current request: staff id (if signed in), IP and user agent. */
export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuditActor => {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const userAgent = req.headers['user-agent'];
    return {
      staffId: req.staff?.staffId ?? null,
      ip: req.ip ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
    };
  },
);
