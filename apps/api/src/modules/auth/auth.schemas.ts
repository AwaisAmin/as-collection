import { z } from 'zod';

import { pkMobileSchema } from '../../common/phone.js';
import { OTP_POLICY } from './otp/otp-policy.js';

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${String(OTP_POLICY.length)}}$`), 'Enter the 6-digit code.');

export const requestOtpSchema = z.strictObject({ phone: pkMobileSchema });

export const verifyOtpSchema = z.strictObject({ phone: pkMobileSchema, code: otpCodeSchema });

/** Google Identity Services `credential` (a JWT). */
export const googleSignInSchema = z.strictObject({
  idToken: z
    .string()
    .min(20)
    .max(4096)
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'Not a Google ID token.'),
});

export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
