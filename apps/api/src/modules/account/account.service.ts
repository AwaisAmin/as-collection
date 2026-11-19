import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import { linkGuestOrders } from '../auth/auth.service.js';
import { type CustomerDto, customerSelect, toCustomerDto } from '../auth/customer.dto.js';
import { OtpService } from '../auth/otp/otp.service.js';
import type { UpdateProfileBody } from './account.schemas.js';

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  error.name === 'PrismaClientKnownRequestError' &&
  (error as Error & { code?: string }).code === 'P2002';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  async profile(customerId: string): Promise<CustomerDto> {
    const row = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: customerSelect,
    });
    return toCustomerDto(row);
  }

  /** Name, email and marketing consent. A new email is unverified until proven (e.g. Google). */
  async updateProfile(customerId: string, body: UpdateProfileBody): Promise<CustomerDto> {
    const current = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true },
    });
    const emailChanged = body.email !== undefined && body.email !== current.email;
    try {
      const row = await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.marketingOptIn !== undefined ? { marketingOptIn: body.marketingOptIn } : {}),
          ...(emailChanged ? { email: body.email, emailVerifiedAt: null } : {}),
        },
        select: customerSelect,
      });
      return toCustomerDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'EMAIL_IN_USE',
          'This email is already used by another account.',
        );
      }
      throw error;
    }
  }

  /** Adds or changes the phone after verifying a code sent to it (`POST /auth/otp` first). */
  async verifyPhone(customerId: string, phone: string, code: string): Promise<CustomerDto> {
    await this.otp.verify(phone, code);
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.customer.findUnique({ where: { phone }, select: { id: true } });
      if (owner && owner.id !== customerId) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'PHONE_IN_USE',
          'This number belongs to another account. Sign in with it instead.',
        );
      }
      const row = await tx.customer.update({
        where: { id: customerId },
        data: { phone, phoneVerifiedAt: new Date() },
        select: customerSelect,
      });
      await linkGuestOrders(tx, customerId, phone);
      return toCustomerDto(row);
    });
  }
}
