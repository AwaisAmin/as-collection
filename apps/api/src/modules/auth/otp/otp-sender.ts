import type { OtpChannel } from '../../../generated/prisma/client.js';

/** Delivers a login code to a phone through one channel. Throws if delivery fails. */
export interface OtpSender {
  readonly channel: OtpChannel;
  /** Name for logs, e.g. `whatsapp-cloud`. */
  readonly name: string;
  send(phoneE164: string, code: string): Promise<void>;
}

/** Ordered list of senders (`OTP_CHANNELS`); the first that succeeds wins. */
export const OTP_SENDERS = Symbol('OTP_SENDERS');

export const OTP_TTL_MINUTES = 5;

export const otpMessage = (code: string) =>
  `${code} is your AS Collection Hub login code. It expires in ${String(OTP_TTL_MINUTES)} ` +
  'minutes. Never share it with anyone.';

/** Fails a provider call that hangs, so the next channel can still be tried in time. */
export const PROVIDER_TIMEOUT_MS = 8_000;

export class OtpProviderError extends Error {
  constructor(provider: string, status: number, body: string) {
    // Provider bodies can be long; keep enough to diagnose. They never contain the code.
    super(`${provider} responded ${String(status)}: ${body.slice(0, 300)}`);
    this.name = 'OtpProviderError';
  }
}
