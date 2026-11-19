import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { ipHashOf } from '../../common/crypto.js';
import { RateLimitedException } from '../../common/http/problem-details.js';
import { windowRetryAfterSeconds } from '../../common/rate-window.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { ContactMessageBody } from './contact.schemas.js';

/** Messages per IP per hour (on top of the strict per-route throttle). */
export const CONTACT_LIMIT = { max: 5, windowMs: 3_600_000 } as const;

/** Contact form → admin inbox. Staff notifications (email / WhatsApp) arrive with B7. */
@Injectable()
export class ContactService {
  private readonly logger = new Logger('Contact');
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
  }

  async submit(body: ContactMessageBody, ip: string | null): Promise<{ received: true }> {
    const now = new Date();
    const ipHash = ipHashOf(this.secret, ip);
    if (ipHash) {
      const recent = await this.prisma.contactMessage.findMany({
        where: { ipHash, createdAt: { gte: new Date(now.getTime() - CONTACT_LIMIT.windowMs) } },
        orderBy: { createdAt: 'desc' },
        take: CONTACT_LIMIT.max,
        select: { createdAt: true },
      });
      const wait = windowRetryAfterSeconds(
        recent.map((r) => r.createdAt),
        CONTACT_LIMIT.max,
        CONTACT_LIMIT.windowMs,
        now,
      );
      if (wait !== null) {
        throw new RateLimitedException(
          'CONTACT_RATE_LIMITED',
          'You have sent several messages recently. Please try WhatsApp or call us instead.',
          wait,
        );
      }
    }

    const message = await this.prisma.contactMessage.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        topic: body.topic,
        orderNumber: body.orderNumber,
        message: body.message,
        ipHash,
      },
      select: { id: true },
    });
    this.logger.log(`Contact message ${message.id} (${body.topic})`);
    return { received: true };
  }
}
