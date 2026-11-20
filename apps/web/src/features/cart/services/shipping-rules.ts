import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { serverEnv } from '@/config/env.server';
import { siteConfig } from '@/config/site';
import { toRupees } from '@/features/catalog/services/api-mappers';
import { apiRequest } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import type { ShippingRules } from '../lib/cart-totals';

/** Cache tag for store settings (delivery fee, contact details…). */
export const SETTINGS_TAG = 'settings';

const fallback: ShippingRules = {
  shippingFee: siteConfig.shippingFee,
  freeShippingThreshold: siteConfig.freeShippingThreshold,
};

/** The delivery fee and free-delivery threshold checkout will charge (store setting). */
export async function getShippingRules(): Promise<ShippingRules> {
  'use cache';
  cacheLife('minutes');
  cacheTag(SETTINGS_TAG);
  if (serverEnv.MOCK_API) return fallback;
  try {
    const shipping = await apiRequest<{ flatFeeMinor: number; freeShippingThresholdMinor: number }>(
      '/content/settings/shipping',
    );
    return {
      shippingFee: toRupees(shipping.flatFeeMinor),
      freeShippingThreshold: toRupees(shipping.freeShippingThresholdMinor),
    };
  } catch (error) {
    // Checkout still re-checks the total with the API, which returns the real rules.
    reportError(error, { action: 'settings.shipping' });
    return fallback;
  }
}
