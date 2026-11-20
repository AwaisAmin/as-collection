import type { AdminMediaDto } from '@as/contracts';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { mediaUrl } from '../catalog/catalog.mapper.js';

export const storedVariantsSchema = z
  .array(z.object({ width: z.number().int(), height: z.number().int(), key: z.string() }))
  .catch([]);
export type StoredVariant = z.infer<typeof storedVariantsSchema>[number];

export const adminMediaSelect = {
  id: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  alt: true,
  variants: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
  _count: {
    select: {
      productMedia: true,
      categoryImages: true,
      categoryBanners: true,
      brandLogos: true,
      collectionImages: true,
    },
  },
} satisfies Prisma.MediaSelect;

type AdminMediaRow = Prisma.MediaGetPayload<{ select: typeof adminMediaSelect }>;

/** Every place an image is used; deleting is refused while this is above zero. */
export const usageCount = (row: Pick<AdminMediaRow, '_count'>) =>
  Object.values(row._count).reduce((sum, n) => sum + n, 0);

/** Every stored object of an image (the full one and its copies). */
export const objectKeys = (row: { storageKey: string; variants: unknown }) => [
  row.storageKey,
  ...storedVariantsSchema.parse(row.variants).map((v) => v.key),
];

export function toAdminMediaDto(baseUrl: string, row: AdminMediaRow): AdminMediaDto {
  return {
    id: row.id,
    url: mediaUrl(baseUrl, row.storageKey),
    width: row.width,
    height: row.height,
    alt: row.alt,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    /** For `srcset`: each copy's width and URL, ascending. */
    variants: storedVariantsSchema
      .parse(row.variants)
      .map((v) => ({ width: v.width, height: v.height, url: mediaUrl(baseUrl, v.key) })),
    usage: {
      products: row._count.productMedia,
      categories: row._count.categoryImages + row._count.categoryBanners,
      brands: row._count.brandLogos,
      collections: row._count.collectionImages,
    },
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
