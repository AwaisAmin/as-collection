import { otpMessage, OtpProviderError, type OtpSender, PROVIDER_TIMEOUT_MS } from './otp-sender.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Sender number (E.164) or a Messaging Service SID (`MG…`). */
  from: string;
}

/** SMS through Twilio's Messages API. */
export class TwilioSmsOtpSender implements OtpSender {
  readonly channel = 'SMS' as const;
  readonly name = 'twilio-sms';

  constructor(
    private readonly config: TwilioConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(phoneE164: string, code: string): Promise<void> {
    const { accountSid, authToken, from } = this.config;
    const form = new URLSearchParams({ To: phoneE164, Body: otpMessage(code) });
    form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);

    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new OtpProviderError(this.name, response.status, await response.text());
  }
}
