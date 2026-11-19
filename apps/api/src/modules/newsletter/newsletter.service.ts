import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { hmacHex, safeEqualHex } from '../../common/crypto.js';
import { DomainException } from '../../common/http/problem-details.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Newsletter sign-ups with explicit consent (timestamped). Unsubscribe links carry an HMAC of
 * the address, so nobody can unsubscribe someone else and no token table is needed.
 */
@Injectable()
export class NewsletterService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
  }

  /** Token for the unsubscribe link in newsletter emails (stable per address). */
  unsubscribeToken(email: string): string {
    return hmacHex(this.secret, `newsletter-unsubscribe:${email.toLowerCase()}`).slice(0, 32);
  }

  async subscribe(email: string, source: string): Promise<{ alreadySubscribed: boolean }> {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { status: true },
    });
    if (existing?.status === 'SUBSCRIBED') return { alreadySubscribed: true };

    if (existing) {
      // Re-subscribing is fresh consent.
      await this.prisma.newsletterSubscriber.update({
        where: { email },
        data: { status: 'SUBSCRIBED', consentAt: new Date(), unsubscribedAt: null, source },
      });
      return { alreadySubscribed: false };
    }
    try {
      await this.prisma.newsletterSubscriber.create({ data: { email, source } });
      return { alreadySubscribed: false };
    } catch (error) {
      // A concurrent request subscribed the same address first.
      if (isUniqueViolation(error)) return { alreadySubscribed: true };
      throw error;
    }
  }

  /** Idempotent: an unknown or already-unsubscribed address with a valid token is a no-op. */
  async unsubscribe(email: string, token: string): Promise<void> {
    if (!safeEqualHex(this.unsubscribeToken(email), token)) {
      throw new DomainException(
        HttpStatus.BAD_REQUEST,
        'INVALID_UNSUBSCRIBE_LINK',
        'This unsubscribe link is invalid. Please use the link from your latest email.',
      );
    }
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email, status: 'SUBSCRIBED' },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    });
  }
}
