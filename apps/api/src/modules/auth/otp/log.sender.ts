import { Logger } from '@nestjs/common';

import { maskPhone } from '../../../common/phone.js';
import type { OtpSender } from './otp-sender.js';

/** Development only (forbidden in production by env validation): writes the code to the log. */
export class LogOtpSender implements OtpSender {
  readonly channel = 'SMS' as const;
  readonly name = 'log';
  private readonly logger = new Logger('OTP');

  send(phoneE164: string, code: string): Promise<void> {
    this.logger.warn(`Development login code for ${maskPhone(phoneE164)}: ${code}`);
    return Promise.resolve();
  }
}
