import type { CustomerDto, LoginResultDto } from '@as/contracts';

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

export type { CustomerDto, LoginResultDto };
