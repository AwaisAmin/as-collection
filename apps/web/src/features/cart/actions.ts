'use server';

import { z } from 'zod';

import { catalogService } from '@/features/catalog/services/catalog.service';
import type { VariantSnapshot } from '@/features/catalog/types';
import { reportError } from '@/lib/errors/report-error';

const idsSchema = z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).max(50);

/** Current price/stock for the variants in a shopper's cart (null on failure → keep cart as is). */
export async function getCartSnapshots(variantIds: string[]): Promise<VariantSnapshot[] | null> {
  const parsed = idsSchema.safeParse(variantIds);
  if (!parsed.success) return null;
  try {
    return await catalogService.getVariantSnapshots(parsed.data);
  } catch (error) {
    reportError(error, { action: 'cart.snapshots' });
    return null;
  }
}
