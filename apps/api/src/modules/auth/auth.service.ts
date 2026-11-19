import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type CustomerRow,
  customerSelect,
  type LoginResultDto,
  toCustomerDto,
} from './customer.dto.js';
import { GoogleIdTokenVerifier } from './google-id-token.verifier.js';
import { type OtpRequestResult, OtpService } from './otp/otp.service.js';
import { type ClientInfo, SessionService } from './session.service.js';

const blocked = () =>
  new DomainException(
    HttpStatus.FORBIDDEN,
    'ACCOUNT_BLOCKED',
    'This account is blocked. Please contact customer support.',
  );

type Tx = Prisma.TransactionClient;

/** Sign-in flows: phone OTP and Google. Both end in a new session. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly google: GoogleIdTokenVerifier,
  ) {}

  requestOtp(phone: string, client: ClientInfo): Promise<OtpRequestResult> {
    return this.otp.request(phone, client.ip);
  }

  async verifyOtp(phone: string, code: string, client: ClientInfo): Promise<LoginResultDto> {
    await this.otp.verify(phone, code);
    const now = new Date();

    const { customer, isNew } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { phone },
        select: { ...customerSelect, status: true, phoneVerifiedAt: true },
      });
      if (existing?.status === 'BLOCKED') throw blocked();

      const row = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: { lastLoginAt: now, phoneVerifiedAt: existing.phoneVerifiedAt ?? now },
            select: customerSelect,
          })
        : await tx.customer.create({
            data: { phone, phoneVerifiedAt: now, lastLoginAt: now },
            select: customerSelect,
          });
      await linkGuestOrders(tx, row.id, phone);
      return { customer: row, isNew: !existing };
    });

    return this.startSession(customer, isNew, client);
  }

  /**
   * Google sign-in. Accounts are matched by Google id, then by *verified* email only: linking on
   * an email someone merely typed would let an attacker pre-register a victim's email and take
   * over their Google sign-in. An unverified copy of the email elsewhere yields to the verified
   * owner.
   */
  async signInWithGoogle(idToken: string, client: ClientInfo): Promise<LoginResultDto> {
    const identity = await this.google.verify(idToken);
    const now = new Date();

    const { customer, isNew } = await this.prisma.$transaction(async (tx) => {
      const select = { ...customerSelect, status: true };
      const bySub = await tx.customer.findUnique({ where: { googleSub: identity.sub }, select });
      const byEmail =
        !bySub && identity.email
          ? await tx.customer.findUnique({ where: { email: identity.email }, select })
          : null;
      const existing = bySub ?? (byEmail?.emailVerifiedAt ? byEmail : null);

      if (existing) {
        if (existing.status === 'BLOCKED') throw blocked();
        const emailFree =
          identity.email && !existing.email
            ? (await tx.customer.count({ where: { email: identity.email } })) === 0
            : false;
        const row = await tx.customer.update({
          where: { id: existing.id },
          data: {
            googleSub: identity.sub,
            lastLoginAt: now,
            ...(existing.name ? {} : { name: identity.name }),
            ...(emailFree ? { email: identity.email, emailVerifiedAt: now } : {}),
          },
          select: customerSelect,
        });
        return { customer: row, isNew: false };
      }

      if (byEmail) {
        // Unverified claim on this email by another account: the verified owner takes it.
        await tx.customer.update({ where: { id: byEmail.id }, data: { email: null } });
      }
      const row = await tx.customer.create({
        data: {
          googleSub: identity.sub,
          email: identity.email,
          emailVerifiedAt: identity.email ? now : null,
          name: identity.name,
          lastLoginAt: now,
        },
        select: customerSelect,
      });
      return { customer: row, isNew: true };
    });

    return this.startSession(customer, isNew, client);
  }

  private async startSession(
    customer: CustomerRow,
    isNew: boolean,
    client: ClientInfo,
  ): Promise<LoginResultDto> {
    const session = await this.sessions.create(customer.id, client);
    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      isNew,
      customer: toCustomerDto(customer),
    };
  }
}

/** Guest orders placed with this (now verified) phone become part of the account. */
export async function linkGuestOrders(tx: Tx, customerId: string, phone: string): Promise<void> {
  await tx.order.updateMany({ where: { phone, customerId: null }, data: { customerId } });
}
