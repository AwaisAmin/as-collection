'use server';

import { z } from 'zod';

import { catalogService } from '@/features/catalog/services/catalog.service';
import type { Product } from '@/features/catalog/types';

const slugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/);

/** Loads full product data on demand for the quick view dialog (cached catalog read). */
export async function getQuickViewProduct(slug: string): Promise<Product | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return catalogService.getProductBySlug(parsed.data);
}
