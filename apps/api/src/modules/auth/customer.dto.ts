import type { Prisma } from '../../generated/prisma/client.js';

export const customerSelect = {
  id: true,
  phone: true,
  email: true,
  emailVerifiedAt: true,
  name: true,
  googleSub: true,
  marketingOptIn: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

export type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;

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

export const toCustomerDto = (row: CustomerRow): CustomerDto => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  emailVerified: row.emailVerifiedAt !== null,
  googleLinked: row.googleSub !== null,
  marketingOptIn: row.marketingOptIn,
  createdAt: row.createdAt.toISOString(),
});

export interface LoginResultDto {
  /** Opaque bearer token. The storefront server keeps it in an HttpOnly cookie. */
  token: string;
  expiresAt: string;
  /** First sign-in: the storefront asks for a name. */
  isNew: boolean;
  customer: CustomerDto;
}
