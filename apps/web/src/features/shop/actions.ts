'use server';

import { z } from 'zod';

import { catalogService } from '@/features/catalog/services/catalog.service';
import type { ProductSummary, VariantDetail } from '@/features/catalog/types';

const idSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** Fresh summaries (price/stock) for product ids kept in the browser (wishlist, recently viewed). */
export async function getProductsByIds(ids: string[]): Promise<ProductSummary[]> {
  const parsed = z.array(idSchema).max(100).safeParse(ids);
  if (!parsed.success) return [];
  return catalogService.getProductSummaries(parsed.data);
}

/** Current data for a single variant (quick "move to cart" from the wishlist). */
export async function getVariantForCart(variantId: string): Promise<VariantDetail | null> {
  const parsed = idSchema.safeParse(variantId);
  if (!parsed.success) return null;
  const [detail] = await catalogService.getVariantDetails([parsed.data]);
  return detail ?? null;
}
