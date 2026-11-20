import { z } from 'zod';

import type { Prisma } from '../../../generated/prisma/client.js';
import { mediaUrl } from '../catalog.mapper.js';

const imageSelect = { id: true, storageKey: true, alt: true, width: true, height: true } as const;

const inventorySelect = {
  onHand: true,
  reserved: true,
  lowStockThreshold: true,
  trackInventory: true,
  allowBackorder: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

export const adminVariantSelect = {
  id: true,
  sku: true,
  title: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  costMinor: true,
  barcode: true,
  weightGrams: true,
  isActive: true,
  position: true,
  options: {
    select: {
      attributeId: true,
      valueId: true,
      attribute: { select: { name: true, position: true } },
      value: { select: { label: true } },
    },
  },
  inventory: { select: inventorySelect },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductVariantSelect;

export const adminProductDetailSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  description: true,
  status: true,
  primaryCategoryId: true,
  brandId: true,
  specifications: true,
  sizeGuide: true,
  isFeatured: true,
  isBestseller: true,
  seoTitle: true,
  seoDescription: true,
  priceMinMinor: true,
  priceMaxMinor: true,
  inStock: true,
  ratingAverage: true,
  ratingCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  primaryCategory: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true } },
  categories: {
    orderBy: { position: 'asc' },
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  attributes: {
    select: {
      attributeId: true,
      valueId: true,
      textValue: true,
      numberValue: true,
      booleanValue: true,
    },
  },
  variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: adminVariantSelect },
  media: {
    orderBy: { position: 'asc' },
    select: {
      alt: true,
      variant: { select: { sku: true } },
      media: { select: imageSelect },
    },
  },
  _count: { select: { orderItems: true, reviews: true } },
} satisfies Prisma.ProductSelect;

export type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof adminProductDetailSelect }>;
type VariantRow = Prisma.ProductVariantGetPayload<{ select: typeof adminVariantSelect }>;

const specificationsSchema = z.array(z.object({ label: z.string(), value: z.string() })).catch([]);

export function toAdminVariantDto(row: VariantRow) {
  const inventory = row.inventory;
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    priceMinor: row.priceMinor,
    compareAtPriceMinor: row.compareAtPriceMinor,
    costMinor: row.costMinor,
    barcode: row.barcode,
    weightGrams: row.weightGrams,
    isActive: row.isActive,
    position: row.position,
    options: row.options
      .toSorted((a, b) => a.attribute.position - b.attribute.position)
      .map((o) => ({
        attributeId: o.attributeId,
        attribute: o.attribute.name,
        valueId: o.valueId,
        value: o.value.label,
      })),
    inventory: inventory && {
      ...inventory,
      available: inventory.onHand - inventory.reserved,
      isLow:
        inventory.trackInventory &&
        inventory.onHand - inventory.reserved <= inventory.lowStockThreshold,
    },
    /** Ordered before: can be deactivated, not deleted. */
    hasOrders: row._count.orderItems > 0,
  };
}

export function toAdminProductDto(baseUrl: string, row: AdminProductRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    status: row.status,
    primaryCategory: row.primaryCategory,
    categories: row.categories.map((c) => c.category),
    brand: row.brand,
    specifications: specificationsSchema.parse(row.specifications),
    sizeGuide: row.sizeGuide,
    isFeatured: row.isFeatured,
    isBestseller: row.isBestseller,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    tags: row.tags.map((t) => t.tag).toSorted((a, b) => a.name.localeCompare(b.name)),
    /** Same shape as the update input, so the edit form can send it straight back. */
    attributes: groupAttributes(row.attributes),
    variants: row.variants.map(toAdminVariantDto),
    media: row.media.map((m) => ({
      mediaId: m.media.id,
      url: mediaUrl(baseUrl, m.media.storageKey),
      width: m.media.width,
      height: m.media.height,
      alt: m.alt,
      mediaAlt: m.media.alt,
      variantSku: m.variant?.sku ?? null,
    })),
    summary: {
      priceMinMinor: row.priceMinMinor,
      priceMaxMinor: row.priceMaxMinor,
      inStock: row.inStock,
      ratingAverage: row.ratingAverage,
      ratingCount: row.ratingCount,
      orders: row._count.orderItems,
      reviews: row._count.reviews,
    },
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    /** Send back as `updatedAt` when saving (conflict detection). */
    updatedAt: row.updatedAt,
  };
}

function groupAttributes(rows: AdminProductRow['attributes']) {
  const byAttribute = new Map<
    string,
    { attributeId: string; valueIds?: string[]; text?: string; number?: number; boolean?: boolean }
  >();
  for (const row of rows) {
    const entry = byAttribute.get(row.attributeId) ?? { attributeId: row.attributeId };
    if (row.valueId) entry.valueIds = [...(entry.valueIds ?? []), row.valueId];
    if (row.textValue !== null) entry.text = row.textValue;
    if (row.numberValue !== null) entry.number = row.numberValue.toNumber();
    if (row.booleanValue !== null) entry.boolean = row.booleanValue;
    byAttribute.set(row.attributeId, entry);
  }
  return [...byAttribute.values()];
}

export const adminProductListSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  priceMinMinor: true,
  priceMaxMinor: true,
  inStock: true,
  isFeatured: true,
  isBestseller: true,
  updatedAt: true,
  publishedAt: true,
  primaryCategory: { select: { id: true, name: true } },
  media: { orderBy: { position: 'asc' }, take: 1, select: { media: { select: imageSelect } } },
  variants: {
    select: {
      isActive: true,
      inventory: {
        select: { onHand: true, reserved: true, lowStockThreshold: true, trackInventory: true },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof adminProductListSelect }>;

export function toAdminProductListItem(baseUrl: string, row: ListRow) {
  const tracked = row.variants.filter((v) => v.isActive && v.inventory?.trackInventory);
  const image = row.media[0]?.media;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    category: row.primaryCategory,
    priceMinMinor: row.priceMinMinor,
    priceMaxMinor: row.priceMaxMinor,
    inStock: row.inStock,
    isFeatured: row.isFeatured,
    isBestseller: row.isBestseller,
    image: image ? { url: mediaUrl(baseUrl, image.storageKey), alt: image.alt } : null,
    variantCount: row.variants.length,
    /** Units available across tracked active variants (null when nothing is tracked). */
    stock: tracked.length
      ? tracked.reduce(
          (sum, v) => sum + (v.inventory ? v.inventory.onHand - v.inventory.reserved : 0),
          0,
        )
      : null,
    lowStockVariants: tracked.filter(
      (v) =>
        v.inventory && v.inventory.onHand - v.inventory.reserved <= v.inventory.lowStockThreshold,
    ).length,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}
