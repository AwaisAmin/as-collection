/* Customer sign-in and account (all require the customer's bearer token, except sign-in). */

/** The signed-in customer, as the storefront sees them. */
export interface CustomerDto {
  id: string;
  name: string | null;
  /** E.164, e.g. `+923001234567`. Null for Google accounts that have not added one yet. */
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  googleLinked: boolean;
  marketingOptIn: boolean;
  createdAt: string;
}

/** `POST /auth/otp/verify`, `POST /auth/google`. */
export interface LoginResultDto {
  /** Opaque bearer token. The storefront server keeps it in an HttpOnly cookie. */
  token: string;
  expiresAt: string;
  /** First sign-in: the storefront asks for a name. */
  isNew: boolean;
  customer: CustomerDto;
}

/** `GET /auth/session`. */
export interface SessionInfoDto {
  customer: CustomerDto;
  expiresAt: string;
}

export type OtpChannel = 'WHATSAPP' | 'SMS';

/** `POST /auth/otp` (202). */
export interface OtpRequestResultDto {
  channel: OtpChannel;
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Development only (OTP_DEV_ECHO); never in production. */
  devCode?: string;
}

/** A saved delivery address. */
export interface AddressDto {
  id: string;
  label: string | null;
  fullName: string;
  /** E.164. */
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One signed-in device (`GET /account/sessions`). */
export interface SessionSummaryDto {
  id: string;
  /** The session making this request. */
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}
