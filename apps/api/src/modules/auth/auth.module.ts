import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CustomerAuthGuard, OptionalCustomerAuthGuard } from './customer-auth.guard.js';
import {
  createGoogleJwks,
  GOOGLE_JWKS,
  GoogleIdTokenVerifier,
} from './google-id-token.verifier.js';
import { LogOtpSender } from './otp/log.sender.js';
import { OtpService } from './otp/otp.service.js';
import { OtpDeliveryService } from './otp/otp-delivery.service.js';
import { OTP_SENDERS, type OtpSender } from './otp/otp-sender.js';
import { TwilioSmsOtpSender } from './otp/twilio-sms.sender.js';
import { WhatsAppCloudOtpSender } from './otp/whatsapp-cloud.sender.js';
import { SessionService } from './session.service.js';

/** Builds the senders for `OTP_CHANNELS`, in order (env validation guarantees credentials). */
function createOtpSenders(config: AppConfig): OtpSender[] {
  const required = (
    key:
      | 'WHATSAPP_PHONE_NUMBER_ID'
      | 'WHATSAPP_ACCESS_TOKEN'
      | 'TWILIO_ACCOUNT_SID'
      | 'TWILIO_AUTH_TOKEN'
      | 'TWILIO_FROM',
  ): string => {
    const value: string | undefined = config.get(key, { infer: true });
    if (!value) throw new Error(`${key} is required for the configured OTP_CHANNELS`);
    return value;
  };
  return config.get('OTP_CHANNELS', { infer: true }).map((channel): OtpSender => {
    switch (channel) {
      case 'whatsapp':
        return new WhatsAppCloudOtpSender({
          phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
          accessToken: required('WHATSAPP_ACCESS_TOKEN'),
          template: config.get('WHATSAPP_OTP_TEMPLATE', { infer: true }),
          language: config.get('WHATSAPP_TEMPLATE_LANGUAGE', { infer: true }),
          graphVersion: config.get('WHATSAPP_GRAPH_VERSION', { infer: true }),
        });
      case 'sms':
        return new TwilioSmsOtpSender({
          accountSid: required('TWILIO_ACCOUNT_SID'),
          authToken: required('TWILIO_AUTH_TOKEN'),
          from: required('TWILIO_FROM'),
        });
      case 'log':
        return new LogOtpSender();
    }
  });
}

/** Customer authentication: OTP + Google sign-in, sessions and the bearer-token guard. */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    OtpDeliveryService,
    SessionService,
    GoogleIdTokenVerifier,
    CustomerAuthGuard,
    OptionalCustomerAuthGuard,
    { provide: OTP_SENDERS, inject: [ConfigService], useFactory: createOtpSenders },
    { provide: GOOGLE_JWKS, useFactory: createGoogleJwks },
  ],
  exports: [SessionService, OtpService, CustomerAuthGuard, OptionalCustomerAuthGuard],
})
export class AuthModule {}
