import { OtpDeliveryFailedError, OtpDeliveryService } from './otp-delivery.service.js';
import type { OtpSender } from './otp-sender.js';
import { TwilioSmsOtpSender } from './twilio-sms.sender.js';
import { WhatsAppCloudOtpSender } from './whatsapp-cloud.sender.js';

function fakeSender(channel: OtpSender['channel'], fails = false) {
  const calls: string[] = [];
  const sender: OtpSender = {
    channel,
    name: channel.toLowerCase(),
    send: (phone, code) => {
      calls.push(`${phone}:${code}`);
      return fails ? Promise.reject(new Error('provider down')) : Promise.resolve();
    },
  };
  return { sender, calls };
}

describe('OtpDeliveryService', () => {
  it('uses the first channel that works', async () => {
    const whatsapp = fakeSender('WHATSAPP');
    const sms = fakeSender('SMS');
    const service = new OtpDeliveryService([whatsapp.sender, sms.sender]);
    await expect(service.deliver('+923001234567', '123456')).resolves.toBe('WHATSAPP');
    expect(whatsapp.calls).toEqual(['+923001234567:123456']);
    expect(sms.calls).toEqual([]);
  });

  it('falls back to SMS when WhatsApp fails', async () => {
    const service = new OtpDeliveryService([
      fakeSender('WHATSAPP', true).sender,
      fakeSender('SMS').sender,
    ]);
    await expect(service.deliver('+923001234567', '123456')).resolves.toBe('SMS');
  });

  it('fails when every channel fails', async () => {
    const service = new OtpDeliveryService([
      fakeSender('WHATSAPP', true).sender,
      fakeSender('SMS', true).sender,
    ]);
    await expect(service.deliver('+923001234567', '123456')).rejects.toBeInstanceOf(
      OtpDeliveryFailedError,
    );
  });
});

describe('provider requests', () => {
  function recordingFetch(status = 200, body = '{}') {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(body, { status }));
    }) as typeof fetch;
    return { calls, fetchImpl };
  }

  it('sends a WhatsApp authentication template with the code in body and button', async () => {
    const { calls, fetchImpl } = recordingFetch();
    await new WhatsAppCloudOtpSender(
      {
        phoneNumberId: '1098',
        accessToken: 'EAAG',
        template: 'login_code',
        language: 'en',
        graphVersion: 'v23.0',
      },
      fetchImpl,
    ).send('+923001234567', '482913');

    const [call] = calls;
    expect(call?.url).toBe('https://graph.facebook.com/v23.0/1098/messages');
    expect(new Headers(call?.init.headers).get('authorization')).toBe('Bearer EAAG');
    const body = JSON.parse(call?.init.body as string) as {
      to: string;
      template: { components: { parameters: { text: string }[] }[] };
    };
    expect(body.to).toBe('923001234567');
    expect(body.template.components.map((c) => c.parameters[0]?.text)).toEqual([
      '482913',
      '482913',
    ]);
  });

  it('sends Twilio SMS from a messaging service when given an MG sid', async () => {
    const { calls, fetchImpl } = recordingFetch();
    await new TwilioSmsOtpSender(
      { accountSid: 'AC1', authToken: 'tok', from: 'MG123' },
      fetchImpl,
    ).send('+923001234567', '482913');

    const form = calls[0]?.init.body as URLSearchParams;
    expect(form.get('MessagingServiceSid')).toBe('MG123');
    expect(form.get('From')).toBeNull();
    expect(form.get('To')).toBe('+923001234567');
    expect(form.get('Body')).toContain('482913');
  });

  it('reports provider errors', async () => {
    const { fetchImpl } = recordingFetch(400, 'invalid number');
    const sender = new TwilioSmsOtpSender(
      { accountSid: 'AC1', authToken: 't', from: '+15005550006' },
      fetchImpl,
    );
    await expect(sender.send('+923001234567', '1')).rejects.toThrow(
      /twilio-sms responded 400: invalid number/,
    );
  });
});
