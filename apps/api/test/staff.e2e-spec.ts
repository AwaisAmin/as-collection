import { randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { base32Decode, hotp, totpStep } from '../src/modules/staff/security/totp.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Staff sign-in (password → TOTP), sessions, RBAC, staff/role admin and the audit log, against
 * the migrated + seeded database. Test staff use @e2e-staff.example.test emails and `e2e-`
 * role keys; their audit rows are purged afterwards through the sanctioned purge switch.
 */
const DOMAIN = '@e2e-staff.example.test';
const PASSWORD = 'correct horse battery staple';

interface LoginStep {
  status: string;
  challengeToken: string;
}

describe('staff auth, RBAC & audit (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  /** Authenticator secrets of enrolled test staff, by email. */
  const secrets = new Map<string, string>();

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const email = (name: string) => `${name}.${randomUUID().slice(0, 6)}${DOMAIN}`;

  async function roleId(key: string): Promise<string> {
    return (await prisma.role.findUniqueOrThrow({ where: { key } })).id;
  }

  async function createStaff(roleKeys: string[], overrides: { mustChangePassword?: boolean } = {}) {
    const address = email('staff');
    const roleIds = await Promise.all(roleKeys.map(roleId));
    const staff = await prisma.staffUser.create({
      data: {
        email: address,
        name: 'E2E Staff',
        passwordHash: await hashPassword(PASSWORD),
        mustChangePassword: overrides.mustChangePassword ?? false,
        roles: { create: roleIds.map((id) => ({ roleId: id })) },
      },
    });
    return { id: staff.id, email: address };
  }

  /** A valid code the server has not seen yet (current step ± 1, after the last used one). */
  async function freshCode(address: string): Promise<string> {
    const secret = secrets.get(address);
    if (!secret) throw new Error(`no secret for ${address}`);
    const staff = await prisma.staffUser.findUniqueOrThrow({ where: { email: address } });
    const current = totpStep(new Date());
    let step = [current - 1, current, current + 1].find(
      (s) => staff.totpLastStep === null || s > staff.totpLastStep,
    );
    if (step === undefined) {
      // More than three sign-ins in 30 s: move the replay marker back (test-only shortcut).
      await prisma.staffUser.update({
        where: { id: staff.id },
        data: { totpLastStep: current - 2 },
      });
      step = current - 1;
    }
    return hotp(base32Decode(secret), step);
  }

  /** Full sign-in (enrolling the authenticator on first use) → bearer token. */
  async function signIn(address: string, password = PASSWORD): Promise<string> {
    const step = (
      await http().post(api('/admin/auth/login')).send({ email: address, password }).expect(200)
    ).body as LoginStep;
    if (step.status === 'TOTP_ENROLMENT_REQUIRED') {
      const enrol = await http()
        .post(api('/admin/auth/totp/enrol'))
        .send({ challengeToken: step.challengeToken })
        .expect(200);
      secrets.set(address, (enrol.body as { secret: string }).secret);
    } else {
      expect(step.status).toBe('TOTP_REQUIRED');
    }
    const res = await http()
      .post(api('/admin/auth/totp/verify'))
      .send({ challengeToken: step.challengeToken, code: await freshCode(address) })
      .expect(200);
    return (res.body as { token: string }).token;
  }

  async function cleanup() {
    const staff = await prisma.staffUser.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    const ids = staff.map((s) => s.id);
    const roles = await prisma.role.findMany({
      where: { key: { startsWith: 'e2e-' } },
      select: { id: true },
    });
    const entityIds = [...ids, ...roles.map((r) => r.id)];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({
        where: { OR: [{ actorStaffId: { in: ids } }, { entityId: { in: entityIds } }] },
      });
    });
    await prisma.staffUser.deleteMany({ where: { id: { in: ids } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
  }

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }));
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('sign-in', () => {
    it('enrols the authenticator on first sign-in, then requires a code', async () => {
      const { id, email: address } = await createStaff(['super-admin']);
      const first = (
        await http()
          .post(api('/admin/auth/login'))
          .send({ email: address, password: PASSWORD })
          .expect(200)
      ).body as LoginStep;
      expect(first.status).toBe('TOTP_ENROLMENT_REQUIRED');

      const enrol = await http()
        .post(api('/admin/auth/totp/enrol'))
        .send({ challengeToken: first.challengeToken })
        .expect(200);
      const { secret, otpauthUri } = enrol.body as { secret: string; otpauthUri: string };
      expect(otpauthUri).toMatch(/^otpauth:\/\/totp\/AS%20Collection%20Admin:/);
      secrets.set(address, secret);

      const stored = await prisma.staffUser.findUniqueOrThrow({ where: { id } });
      expect(stored.totpSecretEncrypted).toMatch(/^v1\./);
      expect(stored.totpSecretEncrypted).not.toContain(secret);
      expect(stored.totpEnabledAt).toBeNull();

      await http()
        .post(api('/admin/auth/totp/verify'))
        .send({ challengeToken: first.challengeToken, code: '000000' })
        .expect(401);
      const ok = await http()
        .post(api('/admin/auth/totp/verify'))
        .send({ challengeToken: first.challengeToken, code: await freshCode(address) })
        .expect(200);
      const { token } = ok.body as { token: string };

      const session = await http().get(api('/admin/auth/session')).set(bearer(token)).expect(200);
      expect(session.body).toMatchObject({
        staff: { id, email: address, totpEnabled: true },
        permissions: ['*'],
      });
      const enabled = await prisma.staffUser.findUniqueOrThrow({ where: { id } });
      expect(enabled).toMatchObject({ failedLoginCount: 0 });
      expect(enabled.totpEnabledAt).not.toBeNull();

      // Next sign-in goes straight to the code step.
      const second = (
        await http()
          .post(api('/admin/auth/login'))
          .send({ email: address, password: PASSWORD })
          .expect(200)
      ).body as LoginStep;
      expect(second.status).toBe('TOTP_REQUIRED');
      await http()
        .post(api('/admin/auth/totp/enrol'))
        .send({ challengeToken: second.challengeToken })
        .expect(401); // a "totp" challenge cannot restart enrolment
    });

    it('refuses a replayed code', async () => {
      const { email: address, id } = await createStaff(['super-admin']);
      await signIn(address);
      const { totpLastStep } = await prisma.staffUser.findUniqueOrThrow({ where: { id } });
      const replay = hotp(base32Decode(secrets.get(address) ?? ''), totpLastStep ?? 0);
      const step = (
        await http()
          .post(api('/admin/auth/login'))
          .send({ email: address, password: PASSWORD })
          .expect(200)
      ).body as LoginStep;
      const res = await http()
        .post(api('/admin/auth/totp/verify'))
        .send({ challengeToken: step.challengeToken, code: replay })
        .expect(401);
      expect(res.body).toMatchObject({ code: 'INVALID_CODE' });
    });

    it('gives the same answer for unknown emails and wrong passwords', async () => {
      const { email: address } = await createStaff(['order-manager']);
      const unknown = await http()
        .post(api('/admin/auth/login'))
        .send({ email: email('ghost'), password: PASSWORD })
        .expect(401);
      const wrong = await http()
        .post(api('/admin/auth/login'))
        .send({ email: address, password: 'wrong password!!' })
        .expect(401);
      expect(unknown.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(wrong.body.detail).toBe(unknown.body.detail);
    });

    it('locks the account after repeated failures; staff managers can unlock it', async () => {
      const { email: address, id } = await createStaff(['order-manager']);
      for (let i = 0; i < 5; i += 1) {
        await http()
          .post(api('/admin/auth/login'))
          .send({ email: address, password: 'nope nope nope' })
          .expect(401);
      }
      const locked = await prisma.staffUser.findUniqueOrThrow({ where: { id } });
      expect(locked.failedLoginCount).toBe(5);
      expect(locked.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
      // Even the right password is refused while locked.
      await http()
        .post(api('/admin/auth/login'))
        .send({ email: address, password: PASSWORD })
        .expect(401);

      const admin = await createStaff(['super-admin']);
      const token = await signIn(admin.email);
      await http()
        .post(api(`/admin/staff/${id}/unlock`))
        .set(bearer(token))
        .expect(204);
      await http()
        .post(api('/admin/auth/login'))
        .send({ email: address, password: PASSWORD })
        .expect(200);
    });

    it('ends sessions on logout, inactivity and when the account is disabled', async () => {
      const admin = await createStaff(['super-admin']);
      const adminToken = await signIn(admin.email);
      const member = await createStaff(['order-manager']);

      const t1 = await signIn(member.email);
      await http().post(api('/admin/auth/logout')).set(bearer(t1)).expect(204);
      await http().get(api('/admin/auth/session')).set(bearer(t1)).expect(401);

      const t2 = await signIn(member.email);
      await prisma.staffSession.updateMany({
        where: { staffId: member.id, revokedAt: null },
        data: { lastSeenAt: new Date(Date.now() - 3 * 3_600_000) },
      });
      await http().get(api('/admin/auth/session')).set(bearer(t2)).expect(401);

      const t3 = await signIn(member.email);
      await http()
        .patch(api(`/admin/staff/${member.id}`))
        .set(bearer(adminToken))
        .send({ status: 'DISABLED' })
        .expect(200);
      await http().get(api('/admin/auth/session')).set(bearer(t3)).expect(401);
      await http()
        .post(api('/admin/auth/login'))
        .send({ email: member.email, password: PASSWORD })
        .expect(401);
    });
  });

  describe('permissions', () => {
    it('denies by default and checks each route’s permission', async () => {
      const member = await createStaff(['order-manager']);
      const token = await signIn(member.email);
      await http().get(api('/admin/staff')).expect(401);
      await http()
        .get(api('/admin/staff'))
        .set(bearer('x'.repeat(43)))
        .expect(401);
      const denied = await http().get(api('/admin/staff')).set(bearer(token)).expect(403);
      expect(denied.body).toMatchObject({ code: 'FORBIDDEN' });
      await http().get(api('/admin/audit-logs')).set(bearer(token)).expect(403);
      const session = await http().get(api('/admin/auth/session')).set(bearer(token)).expect(200);
      expect((session.body as { permissions: string[] }).permissions).toContain('orders.write');
    });

    it('applies role changes immediately', async () => {
      const admin = await createStaff(['super-admin']);
      const adminToken = await signIn(admin.email);
      const member = await createStaff(['order-manager']);
      const token = await signIn(member.email);
      await http().get(api('/admin/audit-logs')).set(bearer(token)).expect(403);

      const role = await http()
        .post(api('/admin/roles'))
        .set(bearer(adminToken))
        .send({ key: 'e2e-auditor', name: 'E2E Auditor', permissions: ['audit.read'] })
        .expect(201);
      await http()
        .patch(api(`/admin/staff/${member.id}`))
        .set(bearer(adminToken))
        .send({ roleIds: [await roleId('order-manager'), (role.body as { id: string }).id] })
        .expect(200);
      await http().get(api('/admin/audit-logs')).set(bearer(token)).expect(200);
    });

    it('requires replacing a temporary password before anything else', async () => {
      const admin = await createStaff(['super-admin']);
      const adminToken = await signIn(admin.email);
      const address = email('new');
      const created = await http()
        .post(api('/admin/staff'))
        .set(bearer(adminToken))
        .send({
          email: address,
          name: 'E2E New',
          password: 'temporary password 1',
          roleIds: [await roleId('order-manager')],
        })
        .expect(201);
      expect(created.body).toMatchObject({
        email: address,
        mustChangePassword: true,
        totpEnabled: false,
      });

      const token = await signIn(address, 'temporary password 1');
      const blocked = await http()
        .get(api('/admin/auth/permissions'))
        .set(bearer(token))
        .expect(403);
      expect(blocked.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
      await http().get(api('/admin/auth/session')).set(bearer(token)).expect(200);

      await http()
        .post(api('/admin/auth/password'))
        .set(bearer(token))
        .send({ currentPassword: 'temporary password 1', newPassword: 'short' })
        .expect(422);
      await http()
        .post(api('/admin/auth/password'))
        .set(bearer(token))
        .send({ currentPassword: 'temporary password 1', newPassword: 'a brand new passphrase' })
        .expect(204);
      await http().get(api('/admin/auth/permissions')).set(bearer(token)).expect(200);
    });
  });

  describe('staff & role administration', () => {
    it('blocks privilege escalation', async () => {
      const admin = await createStaff(['super-admin']);
      const adminToken = await signIn(admin.email);
      const role = await http()
        .post(api('/admin/roles'))
        .set(bearer(adminToken))
        .send({
          key: 'e2e-staff-manager',
          name: 'E2E Staff manager',
          permissions: ['staff.manage', 'roles.manage', 'orders.read'],
        })
        .expect(201);
      const manager = await createStaff([]);
      await prisma.staffRole.create({
        data: { staffId: manager.id, roleId: (role.body as { id: string }).id },
      });
      const token = await signIn(manager.email);

      const toSuper = await http()
        .post(api('/admin/staff'))
        .set(bearer(token))
        .send({
          email: email('climber'),
          name: 'E2E Climber',
          password: 'temporary password 1',
          roleIds: [await roleId('super-admin')],
        })
        .expect(403);
      expect(toSuper.body).toMatchObject({ code: 'PRIVILEGE_ESCALATION' });
      await http()
        .post(api('/admin/roles'))
        .set(bearer(token))
        .send({ key: 'e2e-everything', name: 'E2E Everything', permissions: ['*'] })
        .expect(403);
      // Cannot touch a more powerful account either.
      await http()
        .post(api(`/admin/staff/${admin.id}/reset-2fa`))
        .set(bearer(token))
        .expect(403);
      // Allowed: a role within its own access.
      await http()
        .post(api('/admin/roles'))
        .set(bearer(token))
        .send({ key: 'e2e-viewer', name: 'E2E Viewer', permissions: ['orders.read'] })
        .expect(201);
    });

    it('protects built-in roles and the actor’s own access', async () => {
      const admin = await createStaff(['super-admin']);
      const token = await signIn(admin.email);
      const superAdmin = await roleId('super-admin');
      const system = await http()
        .patch(api(`/admin/roles/${superAdmin}`))
        .set(bearer(token))
        .send({ permissions: ['orders.read'] })
        .expect(409);
      expect(system.body).toMatchObject({ code: 'SYSTEM_ROLE' });
      await http()
        .delete(api(`/admin/roles/${superAdmin}`))
        .set(bearer(token))
        .expect(409);
      const self = await http()
        .patch(api(`/admin/staff/${admin.id}`))
        .set(bearer(token))
        .send({ status: 'DISABLED' })
        .expect(409);
      expect(self.body).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ACCESS' });
      const created = await http()
        .post(api('/admin/roles'))
        .set(bearer(token))
        .send({ key: 'e2e-in-use', name: 'E2E In use', permissions: ['orders.read'] })
        .expect(201);
      const inUseId = (created.body as { id: string }).id;
      const holder = await createStaff([]);
      await prisma.staffRole.create({ data: { staffId: holder.id, roleId: inUseId } });
      const inUse = await http()
        .delete(api(`/admin/roles/${inUseId}`))
        .set(bearer(token))
        .expect(409);
      expect(inUse.body).toMatchObject({ code: 'ROLE_IN_USE' });
      await prisma.staffRole.deleteMany({ where: { roleId: inUseId } });
      await http()
        .delete(api(`/admin/roles/${inUseId}`))
        .set(bearer(token))
        .expect(204);
      await http()
        .post(api('/admin/roles'))
        .set(bearer(token))
        .send({ key: 'e2e-bogus', name: 'E2E Bogus', permissions: ['orders.delete-everything'] })
        .expect(422);
    });

    it('resets 2FA (re-enrolment) and passwords (forced change, signed out)', async () => {
      const admin = await createStaff(['super-admin']);
      const adminToken = await signIn(admin.email);
      const member = await createStaff(['order-manager']);
      const memberToken = await signIn(member.email);

      await http()
        .post(api(`/admin/staff/${member.id}/reset-2fa`))
        .set(bearer(adminToken))
        .expect(204);
      await http().get(api('/admin/auth/session')).set(bearer(memberToken)).expect(401);
      const step = (
        await http()
          .post(api('/admin/auth/login'))
          .send({ email: member.email, password: PASSWORD })
          .expect(200)
      ).body as LoginStep;
      expect(step.status).toBe('TOTP_ENROLMENT_REQUIRED');

      await http()
        .post(api(`/admin/staff/${member.id}/reset-password`))
        .set(bearer(adminToken))
        .send({ password: 'another temp passphrase' })
        .expect(204);
      // The challenge issued before the reset is now void.
      await http()
        .post(api('/admin/auth/totp/enrol'))
        .send({ challengeToken: step.challengeToken })
        .expect(401);
      const row = await prisma.staffUser.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.mustChangePassword).toBe(true);
    });
  });

  describe('audit log', () => {
    it('records admin actions with redacted secrets and paginates by cursor', async () => {
      const admin = await createStaff(['super-admin']);
      const token = await signIn(admin.email);
      const address = email('audited');
      const created = await http()
        .post(api('/admin/staff'))
        .set(bearer(token))
        .send({
          email: address,
          name: 'E2E Audited',
          password: 'temporary password 1',
          roleIds: [],
        })
        .expect(201);
      const staffId = (created.body as { id: string }).id;

      const res = await http()
        .get(api(`/admin/audit-logs?entityId=${staffId}`))
        .set(bearer(token))
        .expect(200);
      const items = (
        res.body as { items: { action: string; changes: unknown; actorStaff: { id: string } }[] }
      ).items;
      expect(items[0]).toMatchObject({ action: 'staff.create', actorStaff: { id: admin.id } });
      expect(JSON.stringify(items)).not.toContain('temporary password 1');

      const page = await http()
        .get(api('/admin/audit-logs?limit=1'))
        .set(bearer(token))
        .expect(200);
      const { nextCursor } = page.body as { nextCursor: string | null };
      expect(nextCursor).not.toBeNull();
      const next = await http()
        .get(api(`/admin/audit-logs?limit=1&before=${nextCursor ?? ''}`))
        .set(bearer(token))
        .expect(200);
      const olderId = (next.body as { items: { id: string }[] }).items[0]?.id ?? '';
      expect(olderId < (nextCursor ?? '')).toBe(true);

      // Record types with an underscore (contact messages) can be filtered too.
      await http()
        .get(api('/admin/audit-logs?entityType=contact_message&action=staff.login_x'))
        .set(bearer(token))
        .expect(200);
    });

    it('is append-only in the database', async () => {
      const row = await prisma.auditLog.findFirstOrThrow({ orderBy: { id: 'desc' } });
      await expect(
        prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } }),
      ).rejects.toThrow(/append-only/);
      await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(
        /append-only/,
      );
    });
  });
});
