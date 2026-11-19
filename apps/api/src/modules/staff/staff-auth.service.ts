import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ClientInfo } from '../auth/session.service.js';
import {
  type ChallengePurpose,
  issueChallenge,
  readChallenge,
} from './security/login-challenge.js';
import {
  dummyPasswordHash,
  hashPassword,
  passwordMentionsEmail,
  verifyPassword,
} from './security/password.js';
import { SecretBox } from './security/secret-box.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from './security/totp.js';
import { type StaffPrincipal, StaffSessionService } from './staff-session.service.js';

/** Consecutive failures (password or code) before the account locks. */
export const LOCKOUT_THRESHOLD = 5;
/** First lock lasts this long; each further failure while over the threshold doubles it (max 24 h). */
export const LOCKOUT_BASE_MINUTES = 15;

const TOTP_ISSUER = 'AS Collection Admin';

export type LoginResult =
  | { status: 'TOTP_REQUIRED' | 'TOTP_ENROLMENT_REQUIRED'; challengeToken: string }
  | ({ status: 'AUTHENTICATED' } & SessionResult);

export interface SessionResult {
  token: string;
  expiresAt: string;
  idleTimeoutMinutes: number;
  staff: { id: string; email: string; name: string; mustChangePassword: boolean };
}

const invalidCredentials = () =>
  new DomainException(
    HttpStatus.UNAUTHORIZED,
    'INVALID_CREDENTIALS',
    'Incorrect email or password, or the account is temporarily locked.',
  );

const invalidChallenge = () =>
  new DomainException(
    HttpStatus.UNAUTHORIZED,
    'CHALLENGE_EXPIRED',
    'Your sign-in expired. Please enter your email and password again.',
  );

const staffSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordHash: true,
  passwordChangedAt: true,
  mustChangePassword: true,
  lockedUntil: true,
  totpSecretEncrypted: true,
  totpEnabledAt: true,
  totpLastStep: true,
} as const;

/**
 * Staff sign-in: password (argon2id) → authenticator code (TOTP, required unless disabled in
 * development) → session. Failures from either step share one counter with exponential lockout.
 * Responses never reveal whether an email exists or why exactly sign-in failed.
 */
@Injectable()
export class StaffAuthService {
  private readonly secret: string;
  private readonly box: SecretBox;
  private readonly requireTotp: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: StaffSessionService,
    private readonly audit: AuditService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
    this.box = new SecretBox(config.get('STAFF_TOTP_KEY', { infer: true }));
    this.requireTotp = config.get('STAFF_REQUIRE_2FA', { infer: true });
  }

  async login(email: string, password: string, client: ClientInfo): Promise<LoginResult> {
    const now = new Date();
    const staff = await this.prisma.staffUser.findUnique({ where: { email }, select: staffSelect });
    if (staff?.status !== 'ACTIVE') {
      await verifyPassword(await dummyPasswordHash(), password); // same timing as a real check
      throw invalidCredentials();
    }
    if (staff.lockedUntil && staff.lockedUntil > now) throw invalidCredentials();

    if (!(await verifyPassword(staff.passwordHash, password))) {
      await this.registerFailure(staff.id, client, 'password');
      throw invalidCredentials();
    }

    const version = staff.passwordChangedAt?.getTime() ?? 0;
    if (staff.totpEnabledAt) {
      return { status: 'TOTP_REQUIRED', challengeToken: this.challenge(staff.id, 'totp', version) };
    }
    if (this.requireTotp) {
      return {
        status: 'TOTP_ENROLMENT_REQUIRED',
        challengeToken: this.challenge(staff.id, 'enrol', version),
      };
    }
    return { status: 'AUTHENTICATED', ...(await this.completeLogin(staff, client, null)) };
  }

  /** Starts (or restarts) authenticator enrolment; the secret is stored encrypted, not yet active. */
  async startEnrolment(challengeToken: string): Promise<{ secret: string; otpauthUri: string }> {
    const staff = await this.staffFromChallenge(challengeToken, ['enrol']);
    if (staff.totpEnabledAt) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'TOTP_ALREADY_ENABLED',
        'Two-factor authentication is already set up.',
      );
    }
    const secret = generateTotpSecret();
    await this.prisma.staffUser.update({
      where: { id: staff.id },
      data: { totpSecretEncrypted: this.box.seal(secret, this.aad(staff.id)), totpLastStep: null },
    });
    return { secret, otpauthUri: otpauthUri(secret, staff.email, TOTP_ISSUER) };
  }

  /** Second step (or enrolment confirmation): a valid authenticator code creates the session. */
  async verifyCode(
    challengeToken: string,
    code: string,
    client: ClientInfo,
  ): Promise<SessionResult> {
    const staff = await this.staffFromChallenge(challengeToken, ['totp', 'enrol']);
    if (!staff.totpSecretEncrypted) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'TOTP_NOT_STARTED',
        'Start two-factor setup first.',
      );
    }
    const secret = this.box.open(staff.totpSecretEncrypted, this.aad(staff.id));
    const step = verifyTotp(secret, code, new Date(), staff.totpLastStep);
    if (step === null) {
      await this.registerFailure(staff.id, client, 'totp');
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CODE',
        'That code is incorrect or expired. Enter the current code from your authenticator app.',
      );
    }
    // Claim the step atomically: two concurrent requests with the same code cannot both pass.
    const claimed = await this.prisma.staffUser.updateMany({
      where: {
        id: staff.id,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    if (claimed.count === 0) throw invalidChallenge();
    return this.completeLogin(staff, client, staff.totpEnabledAt ? null : 'enabled');
  }

  async logout(staff: StaffPrincipal, client: ClientInfo): Promise<void> {
    await this.sessions.revoke(staff.sessionId);
    await this.audit.record(
      { staffId: staff.staffId, ip: client.ip, userAgent: client.userAgent },
      { action: 'staff.logout', entityType: 'staff', entityId: staff.staffId },
    );
  }

  /** Own password change: signs out every other session. */
  async changePassword(
    principal: StaffPrincipal,
    currentPassword: string,
    newPassword: string,
    client: ClientInfo,
  ): Promise<void> {
    const staff = await this.prisma.staffUser.findUniqueOrThrow({
      where: { id: principal.staffId },
      select: { passwordHash: true, email: true },
    });
    if (!(await verifyPassword(staff.passwordHash, currentPassword))) {
      await this.registerFailure(principal.staffId, client, 'password');
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Your current password is incorrect.',
      );
    }
    assertAcceptablePassword(newPassword, staff.email, currentPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: principal.staffId },
        data: {
          passwordHash: await hashPassword(newPassword),
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        },
      });
      await this.audit.record(
        { staffId: principal.staffId, ip: client.ip, userAgent: client.userAgent },
        { action: 'staff.password.change', entityType: 'staff', entityId: principal.staffId },
        tx,
      );
    });
    await this.sessions.revokeAll(principal.staffId, principal.sessionId);
  }

  // ─── Internals ───

  private async completeLogin(
    staff: { id: string; email: string; name: string; mustChangePassword: boolean },
    client: ClientInfo,
    totp: 'enabled' | null,
  ): Promise<SessionResult> {
    const actor = { staffId: staff.id, ip: client.ip, userAgent: client.userAgent };
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: staff.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          ...(totp === 'enabled' ? { totpEnabledAt: new Date() } : {}),
        },
      });
      if (totp === 'enabled') {
        await this.audit.record(
          actor,
          { action: 'staff.totp.enable', entityType: 'staff', entityId: staff.id },
          tx,
        );
      }
      await this.audit.record(
        actor,
        { action: 'staff.login', entityType: 'staff', entityId: staff.id },
        tx,
      );
    });
    const session = await this.sessions.create(staff.id, client);
    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      idleTimeoutMinutes: session.idleTimeoutMinutes,
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        mustChangePassword: staff.mustChangePassword,
      },
    };
  }

  /** Counts a failure atomically; locks with exponential backoff once over the threshold. */
  private async registerFailure(staffId: string, client: ClientInfo, step: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE staff_users SET
        failed_login_count = failed_login_count + 1,
        locked_until = CASE
          WHEN failed_login_count + 1 >= ${LOCKOUT_THRESHOLD}
          THEN now() + make_interval(mins => LEAST(1440,
            ${LOCKOUT_BASE_MINUTES} * power(2, failed_login_count + 1 - ${LOCKOUT_THRESHOLD}))::int)
          ELSE locked_until
        END
      WHERE id = ${staffId}::uuid`;
    await this.audit.record(
      { staffId: null, ip: client.ip, userAgent: client.userAgent },
      { action: 'staff.login.failed', entityType: 'staff', entityId: staffId, changes: { step } },
    );
  }

  private async staffFromChallenge(token: string, purposes: ChallengePurpose[]) {
    const challenge = readChallenge(this.secret, token, purposes, new Date());
    if (!challenge) throw invalidChallenge();
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: challenge.staffId },
      select: staffSelect,
    });
    if (
      staff?.status !== 'ACTIVE' ||
      (staff.passwordChangedAt?.getTime() ?? 0) !== challenge.passwordVersion
    ) {
      throw invalidChallenge();
    }
    if (staff.lockedUntil && staff.lockedUntil > new Date()) throw invalidCredentials();
    // An "enrol" challenge cannot skip the code once 2FA is active (and vice versa is fine).
    if (challenge.purpose === 'enrol' && staff.totpEnabledAt && purposes.includes('totp')) {
      throw invalidChallenge();
    }
    return staff;
  }

  private challenge(staffId: string, purpose: ChallengePurpose, version: number): string {
    return issueChallenge(this.secret, staffId, purpose, version, new Date());
  }

  private aad(staffId: string): string {
    return `staff-totp:${staffId}`;
  }
}

/** Password rules beyond the schema (things that need the account context). */
export function assertAcceptablePassword(password: string, email: string, previous?: string): void {
  const problem = passwordMentionsEmail(password, email)
    ? 'Do not include your email name in the password.'
    : previous !== undefined && password === previous
      ? 'Choose a password different from the current one.'
      : null;
  if (problem) {
    throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'WEAK_PASSWORD', problem);
  }
}
