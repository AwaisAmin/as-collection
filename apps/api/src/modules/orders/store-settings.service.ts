import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { DomainException } from '../../common/http/problem-details.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../redis/cache.service.js';
import { StorefrontRevalidator } from '../../storefront/storefront-revalidator.js';
import type { ShippingRules } from './pricing.js';

export const SETTINGS_CACHE = 'settings';

const shippingSchema = z.object({
  flatFeeMinor: z.int().min(0),
  freeShippingThresholdMinor: z.int().min(0),
});

/** Store settings used by checkout. Admin edits must call `invalidate()`. */
@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly storefront: StorefrontRevalidator,
  ) {}

  async shipping(): Promise<ShippingRules> {
    const value = await this.cache.getOrSet(SETTINGS_CACHE, 'shipping', 300, async () => {
      const row = await this.prisma.setting.findUnique({ where: { key: 'shipping' } });
      return row?.value ?? null;
    });
    const parsed = shippingSchema.safeParse(value);
    if (!parsed.success) {
      // Never guess a delivery fee: refuse checkout until the store is configured.
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORE_NOT_CONFIGURED',
        'Checkout is temporarily unavailable. Please try again shortly.',
      );
    }
    return parsed.data;
  }

  invalidate(): Promise<void> {
    this.storefront.revalidate('settings');
    return this.cache.invalidate(SETTINGS_CACHE);
  }
}
