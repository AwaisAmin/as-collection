import type { AdminRoleDto, AdminStaffDto } from '@as/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/http/problem-details.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../audit/audit.service.js';
import { ALL, covers } from './permissions.js';
import { hashPassword } from './security/password.js';
import type {
  CreateRoleBody,
  CreateStaffBody,
  UpdateRoleBody,
  UpdateStaffBody,
} from './staff.schemas.js';
import { assertAcceptablePassword } from './staff-auth.service.js';
import type { StaffPrincipal } from './staff-session.service.js';
import { StaffSessionService } from './staff-session.service.js';

type Tx = Prisma.TransactionClient;

const staffListSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  totpEnabledAt: true,
  mustChangePassword: true,
  failedLoginCount: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} satisfies Prisma.StaffUserSelect;

type StaffRow = Prisma.StaffUserGetPayload<{ select: typeof staffListSelect }>;

const toStaffDto = (s: StaffRow): AdminStaffDto => ({
  id: s.id,
  email: s.email,
  name: s.name,
  status: s.status,
  totpEnabled: s.totpEnabledAt !== null,
  mustChangePassword: s.mustChangePassword,
  locked: s.lockedUntil !== null && s.lockedUntil > new Date(),
  lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
  roles: s.roles.map((r) => r.role),
});

/**
 * Changes that can remove access run one at a time, so two admins disabling each other at the
 * same moment cannot both pass the "last super admin" check.
 */
const serializeAccessChanges = (tx: Tx) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('staff-access', 0))`;

const fail = (status: HttpStatus, code: string, detail: string) =>
  new DomainException(status, code, detail);

const notFound = (what: 'Staff member' | 'Role') =>
  fail(
    HttpStatus.NOT_FOUND,
    what === 'Role' ? 'ROLE_NOT_FOUND' : 'STAFF_NOT_FOUND',
    `${what} not found.`,
  );

const escalation = () =>
  fail(
    HttpStatus.FORBIDDEN,
    'PRIVILEGE_ESCALATION',
    'You can only grant or change access you have yourself.',
  );

/**
 * Staff accounts and roles. Every change is audited in the same transaction, and guarded
 * against privilege escalation, self-lockout and removing the last full administrator.
 */
@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: StaffSessionService,
    private readonly audit: AuditService,
  ) {}

  // ─── Staff ───

  async listStaff(): Promise<AdminStaffDto[]> {
    const rows = await this.prisma.staffUser.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: staffListSelect,
    });
    return rows.map(toStaffDto);
  }

  async createStaff(
    actor: StaffPrincipal,
    audit: AuditActor,
    body: CreateStaffBody,
  ): Promise<AdminStaffDto> {
    assertAcceptablePassword(body.password, body.email);
    const passwordHash = await hashPassword(body.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertCanAssign(tx, actor, body.roleIds);
        const created = await tx.staffUser.create({
          data: {
            email: body.email,
            name: body.name,
            passwordHash,
            mustChangePassword: true,
            roles: { create: body.roleIds.map((roleId) => ({ roleId })) },
          },
          select: staffListSelect,
        });
        await this.audit.record(
          audit,
          {
            action: 'staff.create',
            entityType: 'staff',
            entityId: created.id,
            changes: { email: body.email, name: body.name, roleIds: body.roleIds },
          },
          tx,
        );
        return toStaffDto(created);
      });
    } catch (error) {
      if (isUniqueViolation(error, 'email')) {
        throw fail(HttpStatus.CONFLICT, 'EMAIL_IN_USE', 'A staff member with this email exists.');
      }
      throw error;
    }
  }

  async updateStaff(
    actor: StaffPrincipal,
    audit: AuditActor,
    staffId: string,
    body: UpdateStaffBody,
  ) {
    const self = staffId === actor.staffId;
    if (self && (body.status !== undefined || body.roleIds !== undefined)) {
      throw fail(
        HttpStatus.CONFLICT,
        'CANNOT_CHANGE_OWN_ACCESS',
        'Ask another administrator to change your own status or roles.',
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await serializeAccessChanges(tx);
      const before = await this.lockStaff(tx, actor, staffId);
      if (body.roleIds) await this.assertCanAssign(tx, actor, body.roleIds);

      const row = await tx.staffUser.update({
        where: { id: staffId },
        data: {
          name: body.name,
          status: body.status,
          ...(body.roleIds
            ? {
                roles: {
                  deleteMany: {},
                  create: body.roleIds.map((roleId) => ({ roleId })),
                },
              }
            : {}),
        },
        select: staffListSelect,
      });
      await this.assertSuperAdminRemains(tx);
      const changes = diff(
        { name: before.name, status: before.status, roleIds: before.roleIds },
        { name: body.name, status: body.status, roleIds: body.roleIds?.toSorted() },
      );
      if (changes) {
        await this.audit.record(
          audit,
          { action: 'staff.update', entityType: 'staff', entityId: staffId, changes },
          tx,
        );
      }
      return row;
    });
    if (body.status === 'DISABLED') await this.sessions.revokeAll(staffId);
    return toStaffDto(updated);
  }

  /** Sets a temporary password; the staff member must change it and is signed out everywhere. */
  async resetPassword(actor: StaffPrincipal, audit: AuditActor, staffId: string, password: string) {
    await this.prisma.$transaction(async (tx) => {
      const target = await this.lockStaff(tx, actor, staffId);
      assertAcceptablePassword(password, target.email);
      await tx.staffUser.update({
        where: { id: staffId },
        data: {
          passwordHash: await hashPassword(password),
          passwordChangedAt: new Date(),
          mustChangePassword: true,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await this.audit.record(
        audit,
        { action: 'staff.password.reset', entityType: 'staff', entityId: staffId },
        tx,
      );
    });
    await this.sessions.revokeAll(staffId);
  }

  /** Removes the authenticator; the staff member enrols again at next sign-in. */
  async resetTotp(actor: StaffPrincipal, audit: AuditActor, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockStaff(tx, actor, staffId);
      await tx.staffUser.update({
        where: { id: staffId },
        data: { totpSecretEncrypted: null, totpEnabledAt: null, totpLastStep: null },
      });
      await this.audit.record(
        audit,
        { action: 'staff.totp.reset', entityType: 'staff', entityId: staffId },
        tx,
      );
    });
    await this.sessions.revokeAll(staffId);
  }

  async unlock(actor: StaffPrincipal, audit: AuditActor, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockStaff(tx, actor, staffId);
      await tx.staffUser.update({
        where: { id: staffId },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      await this.audit.record(
        audit,
        { action: 'staff.unlock', entityType: 'staff', entityId: staffId },
        tx,
      );
    });
  }

  async revokeSessions(actor: StaffPrincipal, audit: AuditActor, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockStaff(tx, actor, staffId);
      await this.audit.record(
        audit,
        { action: 'staff.sessions.revoke', entityType: 'staff', entityId: staffId },
        tx,
      );
    });
    return { revoked: await this.sessions.revokeAll(staffId, actor.sessionId) };
  }

  // ─── Roles ───

  async listRoles(): Promise<AdminRoleDto[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: true }, orderBy: { permission: 'asc' } },
        _count: { select: { staff: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((p) => p.permission),
      staffCount: r._count.staff,
    }));
  }

  async createRole(actor: StaffPrincipal, audit: AuditActor, body: CreateRoleBody) {
    if (!covers(actor.permissions, body.permissions)) throw escalation();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: {
            key: body.key,
            name: body.name,
            description: body.description ?? null,
            permissions: { create: body.permissions.map((permission) => ({ permission })) },
          },
          select: { id: true },
        });
        await this.audit.record(
          audit,
          { action: 'role.create', entityType: 'role', entityId: role.id, changes: body },
          tx,
        );
        return role;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'key')) {
        throw fail(HttpStatus.CONFLICT, 'ROLE_KEY_IN_USE', 'A role with this key already exists.');
      }
      throw error;
    }
  }

  async updateRole(actor: StaffPrincipal, audit: AuditActor, roleId: string, body: UpdateRoleBody) {
    await this.prisma.$transaction(async (tx) => {
      await serializeAccessChanges(tx);
      const role = await this.lockRole(tx, roleId);
      if (role.isSystem && body.permissions) {
        throw fail(
          HttpStatus.CONFLICT,
          'SYSTEM_ROLE',
          'Built-in role permissions cannot be changed.',
        );
      }
      if (!covers(actor.permissions, role.permissions)) throw escalation();
      if (body.permissions && !covers(actor.permissions, body.permissions)) throw escalation();

      await tx.role.update({
        where: { id: roleId },
        data: {
          name: body.name,
          description: body.description,
          ...(body.permissions
            ? {
                permissions: {
                  deleteMany: {},
                  create: body.permissions.map((permission) => ({ permission })),
                },
              }
            : {}),
        },
      });
      await this.assertSuperAdminRemains(tx);
      const changes = diff(
        { name: role.name, description: role.description, permissions: role.permissions },
        { name: body.name, description: body.description, permissions: body.permissions },
      );
      if (changes) {
        await this.audit.record(
          audit,
          { action: 'role.update', entityType: 'role', entityId: roleId, changes },
          tx,
        );
      }
    });
  }

  async deleteRole(actor: StaffPrincipal, audit: AuditActor, roleId: string) {
    await this.prisma.$transaction(async (tx) => {
      const role = await this.lockRole(tx, roleId);
      if (role.isSystem) {
        throw fail(HttpStatus.CONFLICT, 'SYSTEM_ROLE', 'Built-in roles cannot be deleted.');
      }
      if (!covers(actor.permissions, role.permissions)) throw escalation();
      if ((await tx.staffRole.count({ where: { roleId } })) > 0) {
        throw fail(
          HttpStatus.CONFLICT,
          'ROLE_IN_USE',
          'Remove this role from every staff member before deleting it.',
        );
      }
      await tx.role.delete({ where: { id: roleId } });
      await this.audit.record(
        audit,
        {
          action: 'role.delete',
          entityType: 'role',
          entityId: roleId,
          changes: { key: role.key, permissions: role.permissions },
        },
        tx,
      );
    });
  }

  // ─── Guards ───

  /**
   * Row-locks the target (serialising concurrent edits) and refuses if it holds access the actor
   * lacks — a "staff manager" cannot reset a super admin's password or 2FA.
   */
  private async lockStaff(tx: Tx, actor: StaffPrincipal, staffId: string) {
    await tx.$executeRaw`SELECT 1 FROM staff_users WHERE id = ${staffId}::uuid FOR UPDATE`;
    const target = await tx.staffUser.findUnique({
      where: { id: staffId },
      select: {
        email: true,
        name: true,
        status: true,
        roles: {
          select: {
            roleId: true,
            role: { select: { permissions: { select: { permission: true } } } },
          },
        },
      },
    });
    if (!target) throw notFound('Staff member');
    const permissions = target.roles.flatMap((r) => r.role.permissions.map((p) => p.permission));
    if (staffId !== actor.staffId && !covers(actor.permissions, permissions)) throw escalation();
    return { ...target, roleIds: target.roles.map((r) => r.roleId).sort() };
  }

  private async lockRole(tx: Tx, roleId: string) {
    await tx.$executeRaw`SELECT 1 FROM roles WHERE id = ${roleId}::uuid FOR UPDATE`;
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: true } },
      },
    });
    if (!role) throw notFound('Role');
    return { ...role, permissions: role.permissions.map((p) => p.permission).sort() };
  }

  private async assertCanAssign(tx: Tx, actor: StaffPrincipal, roleIds: readonly string[]) {
    if (!roleIds.length) return;
    const roles = await tx.role.findMany({
      where: { id: { in: [...roleIds] } },
      select: { id: true, permissions: { select: { permission: true } } },
    });
    if (roles.length !== roleIds.length) throw notFound('Role');
    const permissions = roles.flatMap((r) => r.permissions.map((p) => p.permission));
    if (!covers(actor.permissions, permissions)) throw escalation();
  }

  /** At least one active staff member must keep full access ("*"), or nobody could fix things. */
  private async assertSuperAdminRemains(tx: Tx) {
    const count = await tx.staffUser.count({
      where: {
        status: 'ACTIVE',
        roles: { some: { role: { permissions: { some: { permission: ALL } } } } },
      },
    });
    if (count === 0) {
      throw fail(
        HttpStatus.CONFLICT,
        'LAST_SUPER_ADMIN',
        'At least one active staff member must keep full access.',
      );
    }
  }
}
