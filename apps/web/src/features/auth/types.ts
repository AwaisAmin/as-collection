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

export type VerifyOtpResult =
  | { ok: true; user: User; isNew: boolean }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'expired' | 'too_many_attempts' | 'no_challenge' };
