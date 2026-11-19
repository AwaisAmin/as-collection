import { OtpProviderError, type OtpSender, PROVIDER_TIMEOUT_MS } from './otp-sender.js';

export interface WhatsAppCloudConfig {
  phoneNumberId: string;
  accessToken: string;
  template: string;
  language: string;
  graphVersion: string;
}

/**
 * WhatsApp Cloud API (Meta) with an approved AUTHENTICATION template ("{{1}} is your
 * verification code" + a copy-code button, which takes the code as its URL parameter).
 */
export class WhatsAppCloudOtpSender implements OtpSender {
  readonly channel = 'WHATSAPP' as const;
  readonly name = 'whatsapp-cloud';

  constructor(
    private readonly config: WhatsAppCloudConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(phoneE164: string, code: string): Promise<void> {
    const { graphVersion, phoneNumberId, accessToken, template, language } = this.config;
    const response = await this.fetchImpl(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneE164.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: template,
            language: { code: language },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: code }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new OtpProviderError(this.name, response.status, await response.text());
  }
}
