import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../app.module.js';
import { hmacHex, ipHashOf, randomDigits, safeEqualHex } from '../../../common/crypto.js';
import { DomainException, RateLimitedException } from '../../../common/http/problem-details.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { OtpChannel } from '../../../generated/prisma/client.js';
import { OtpDeliveryFailedError, OtpDeliveryService } from './otp-delivery.service.js';
import { decideOtpRequest, OTP_POLICY } from './otp-policy.js';

export interface OtpRequestResult {
  channel: OtpChannel;
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Only with OTP_DEV_ECHO (never allowed in production). */
  devCode?: string;
}

const otpError = (code: string, detail: string, extensions?: Record<string, number>) =>
  new DomainException(HttpStatus.BAD_REQUEST, code, detail, { extensions });

/**
 * One-time login codes.
 *
 * - Codes are random, single-use, expire after 5 minutes and allow 5 guesses.
 * - Only an HMAC of `phone:code` is stored (keyed by AUTH_SECRET); requester IPs are HMACed too.
 * - Requests for one phone are serialized with a transaction-scoped advisory lock, so parallel
 *   requests cannot slip past the cooldown; attempts are counted with conditional updates, so
 *   parallel guesses cannot exceed the limit.
 * - A new code replaces the previous one.
 */
@Injectable()
export class OtpService {
  private readonly secret: string;
  private readonly devEcho: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: OtpDeliveryService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
    this.devEcho = config.get('OTP_DEV_ECHO', { infer: true });
  }

  private codeHash(phone: string, code: string): string {
    return hmacHex(this.secret, `otp:${phone}:${code}`);
  }

  ipHash(ip: string | null): string | null {
    return ipHashOf(this.secret, ip);
  }

  async request(phone: string, ip: string | null): Promise<OtpRequestResult> {
    const now = new Date();
    const code = randomDigits(OTP_POLICY.length);
    const ipHash = this.ipHash(ip);

    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${phone}`}, 0))`;
      const phoneRequests = await tx.otpChallenge.findMany({
        where: { phone, createdAt: { gte: new Date(now.getTime() - OTP_POLICY.phoneWindowMs) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const ipRequests = ipHash
        ? await tx.otpChallenge.findMany({
            where: { ipHash, createdAt: { gte: new Date(now.getTime() - OTP_POLICY.ipWindowMs) } },
            orderBy: { createdAt: 'desc' },
            take: OTP_POLICY.maxPerIp,
            select: { createdAt: true },
          })
        : [];

      const decision = decideOtpRequest(
        phoneRequests.map((r) => r.createdAt),
        ipRequests.map((r) => r.createdAt),
        now,
      );
      if (!decision.allowed) {
        throw new RateLimitedException(
          'OTP_RATE_LIMITED',
          'Too many codes requested. Please wait before asking for another one.',
          decision.retryAfterSeconds,
        );
      }

      // Only the newest code is valid.
      await tx.otpChallenge.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.otpChallenge.create({
        data: {
          phone,
          codeHash: this.codeHash(phone, code),
          channel: this.delivery.primaryChannel,
          expiresAt: new Date(now.getTime() + OTP_POLICY.ttlMs),
          ipHash,
        },
        select: { id: true, channel: true },
      });
    });

    let channel: OtpChannel;
    try {
      channel = await this.delivery.deliver(phone, code);
    } catch (error) {
      if (!(error instanceof OtpDeliveryFailedError)) throw error;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'OTP_DELIVERY_FAILED',
        'We could not send the code right now. Please try again in a minute.',
      );
    }
    if (channel !== challenge.channel) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { channel } });
    }

    return {
      channel,
      expiresInSeconds: OTP_POLICY.ttlMs / 1000,
      resendInSeconds: OTP_POLICY.resendCooldownMs / 1000,
      ...(this.devEcho ? { devCode: code } : {}),
    };
  }

  /** Consumes the phone's current code if `code` matches; throws a 400 problem otherwise. */
  async verify(phone: string, code: string): Promise<void> {
    const now = new Date();
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true, expiresAt: true },
    });
    if (!challenge) {
      throw otpError('OTP_NOT_REQUESTED', 'No active code for this number. Request a new one.');
    }
    if (challenge.expiresAt <= now) {
      throw otpError('OTP_EXPIRED', 'This code has expired. Request a new one.');
    }

    // Claim one attempt atomically: parallel guesses cannot exceed the limit.
    const claimed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: { lt: OTP_POLICY.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) throw this.tooManyAttempts();

    if (!safeEqualHex(challenge.codeHash, this.codeHash(phone, code))) {
      const attemptsLeft = OTP_POLICY.maxAttempts - (challenge.attempts + 1);
      if (attemptsLeft <= 0) {
        await this.prisma.otpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: now },
        });
        throw this.tooManyAttempts();
      }
      throw otpError('OTP_INVALID', 'That code is not right. Please check and try again.', {
        attemptsLeft,
      });
    }

    // Single use: only one request can consume it.
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) {
      throw otpError('OTP_NOT_REQUESTED', 'This code was already used. Request a new one.');
    }
  }

  private tooManyAttempts(): DomainException {
    return otpError('OTP_TOO_MANY_ATTEMPTS', 'Too many wrong codes. Request a new one.');
  }
}
