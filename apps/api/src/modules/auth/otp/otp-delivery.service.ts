import { Inject, Injectable, Logger } from '@nestjs/common';

import { maskPhone } from '../../../common/phone.js';
import type { OtpChannel } from '../../../generated/prisma/client.js';
import { OTP_SENDERS, type OtpSender } from './otp-sender.js';

export class OtpDeliveryFailedError extends Error {
  constructor() {
    super('Every OTP channel failed');
    this.name = 'OtpDeliveryFailedError';
  }
}

/** Sends a code through the configured channels in order (WhatsApp → SMS fallback). */
@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger('OtpDelivery');

  constructor(@Inject(OTP_SENDERS) private readonly senders: readonly OtpSender[]) {}

  /** Channel tried first (recorded on new challenges until delivery says otherwise). */
  get primaryChannel(): OtpChannel {
    return this.senders[0]?.channel ?? 'SMS';
  }

  async deliver(phoneE164: string, code: string): Promise<OtpChannel> {
    for (const sender of this.senders) {
      try {
        await sender.send(phoneE164, code);
        return sender.channel;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`${sender.name} failed for ${maskPhone(phoneE164)}: ${reason}`);
      }
    }
    throw new OtpDeliveryFailedError();
  }
}
