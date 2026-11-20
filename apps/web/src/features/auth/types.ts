export interface User {
  id: string;
  /** Verified via OTP, normalized "03XXXXXXXXX". Empty for Google users until they add one. */
  phone: string;
  name: string;
  email?: string;
  /** Signed in with Google at least once. */
  googleLinked: boolean;
  createdAt: string;
}

/** Saved delivery address (account address book). Orders keep their own copy. */
export interface Address {
  id: string;
  /** e.g. "Home", "Office", "Ammi". */
  label: string;
  recipientName: string;
  phone: string;
  city: string;
  address: string;
  postalCode?: string;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

export type RequestOtpResult =
  | {
      ok: true;
      resendIn: number;
      /** Only in mock/dev mode — never in production. */ devCode?: string;
    }
  | { ok: false; reason: 'rate_limited'; retryIn: number };

/** A new session; the token goes into our HttpOnly cookie and never reaches the browser's JS. */
export interface NewSession {
  token: string;
  expiresAt: Date;
}

export type SignInSuccess = { ok: true; user: User; isNew: boolean; session: NewSession };

export type VerifyOtpResult =
  | SignInSuccess
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'expired' | 'too_many_attempts' | 'no_challenge' };

export type GoogleSignInResult = SignInSuccess | { ok: false; error: string };

/** One device signed in to the account (profile → signed-in devices). */
export interface DeviceSession {
  id: string;
  /** The device making this request. */
  current: boolean;
  /** e.g. "Chrome on Android". */
  device: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}
