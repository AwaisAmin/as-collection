import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';

import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateAddressBody, UpdateAddressBody } from './account.schemas.js';

/** Saved addresses per customer (enough for home, office, family; stops abuse). */
export const MAX_ADDRESSES = 20;

const addressSelect = {
  id: true,
  label: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  province: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

type AddressRow = Prisma.AddressGetPayload<{ select: typeof addressSelect }>;

export type AddressDto = Omit<AddressRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const toDto = (row: AddressRow): AddressDto => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const notFound = () => new NotFoundException('Address not found.');

/**
 * Address book. Exactly one default whenever any address exists: the first address becomes the
 * default, and deleting the default promotes the most recent remaining one. A partial unique index
 * guarantees at most one default even under concurrent requests.
 */
@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: addressSelect,
    });
    return rows.map(toDto);
  }

  async create(customerId: string, body: CreateAddressBody): Promise<AddressDto> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize address-book writes per customer (limit + default stay consistent).
      await tx.$executeRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
      const count = await tx.address.count({ where: { customerId } });
      if (count >= MAX_ADDRESSES) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'ADDRESS_LIMIT_REACHED',
          `You can save up to ${String(MAX_ADDRESSES)} addresses. Remove one to add another.`,
        );
      }
      const isDefault = body.isDefault === true || count === 0;
      if (isDefault)
        await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      const row = await tx.address.create({
        data: { ...body, customerId, isDefault },
        select: addressSelect,
      });
      return toDto(row);
    });
  }

  async update(customerId: string, id: string, body: UpdateAddressBody): Promise<AddressDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
      const owned = await tx.address.count({ where: { id, customerId } });
      if (!owned) throw notFound();
      const { isDefault, ...fields } = body;
      if (isDefault) {
        await tx.address.updateMany({
          where: { customerId, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const row = await tx.address.update({
        where: { id },
        data: { ...fields, ...(isDefault ? { isDefault: true } : {}) },
        select: addressSelect,
      });
      return toDto(row);
    });
  }

  async remove(customerId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
      const address = await tx.address.findFirst({
        where: { id, customerId },
        select: { isDefault: true },
      });
      if (!address) throw notFound();
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { customerId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }
}
