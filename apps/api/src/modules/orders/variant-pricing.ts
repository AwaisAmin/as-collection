import type { Prisma } from '../../generated/prisma/client.js';
import { mediaUrl } from '../catalog/catalog.mapper.js';
import type { PricedVariant } from './pricing.js';

/** Everything checkout needs about a variant, in one query. */
export const pricedVariantSelect = {
  id: true,
  sku: true,
  title: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  isActive: true,
  inventory: {
    select: { onHand: true, reserved: true, trackInventory: true, allowBackorder: true },
  },
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      publishedAt: true,
      media: {
        orderBy: { position: 'asc' },
        take: 12,
        select: { variantId: true, alt: true, media: { select: { storageKey: true, alt: true } } },
      },
    },
  },
} satisfies Prisma.ProductVariantSelect;

type Row = Prisma.ProductVariantGetPayload<{ select: typeof pricedVariantSelect }>;

export function toPricedVariant(row: Row, mediaBaseUrl: string, now: Date): PricedVariant {
  const { product } = row;
  const image =
    product.media.find((m) => m.variantId === row.id) ??
    product.media.find((m) => m.variantId === null) ??
    product.media[0];
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    priceMinor: row.priceMinor,
    compareAtPriceMinor: row.compareAtPriceMinor,
    sellable:
      row.isActive &&
      product.status === 'ACTIVE' &&
      product.publishedAt !== null &&
      product.publishedAt <= now,
    image: image
      ? {
          url: mediaUrl(mediaBaseUrl, image.media.storageKey),
          alt: image.alt ?? image.media.alt ?? product.name,
        }
      : null,
    inventory: row.inventory
      ? {
          onHand: row.inventory.onHand,
          reserved: row.inventory.reserved,
          tracked: row.inventory.trackInventory,
          backorder: row.inventory.allowBackorder,
        }
      : null,
  };
}
