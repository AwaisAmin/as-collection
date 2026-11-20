import type { AddressDto, CustomerDto } from '@as/contracts';

import { normalizePkMobile } from '@/lib/utils/phone';

import type { Address, AddressInput, User } from '../types';

/* API customer/address shapes ↔ the storefront's. Pure, unit-tested. */

/** API phones are E.164 (+923001234567); the storefront shows 03001234567. */
const localPhone = (e164: string | null) => (e164 ? (normalizePkMobile(e164) ?? e164) : '');

export const toUser = (dto: CustomerDto): User => ({
  id: dto.id,
  phone: localPhone(dto.phone),
  name: dto.name ?? '',
  ...(dto.email ? { email: dto.email } : {}),
  googleLinked: dto.googleLinked,
  createdAt: dto.createdAt,
});

export const toAddress = (dto: AddressDto): Address => ({
  id: dto.id,
  label: dto.label ?? 'Address',
  recipientName: dto.fullName,
  phone: localPhone(dto.phone),
  city: dto.city,
  address: [dto.line1, dto.line2].filter(Boolean).join(', '),
  ...(dto.postalCode ? { postalCode: dto.postalCode } : {}),
  isDefault: dto.isDefault,
});

export const toAddressBody = (input: AddressInput) => ({
  label: input.label,
  fullName: input.recipientName,
  phone: input.phone,
  line1: input.address,
  city: input.city,
  postalCode: input.postalCode ?? '',
  // The API can only make an address the default ("un-defaulting" one picks another).
  ...(input.isDefault ? { isDefault: true as const } : {}),
});
