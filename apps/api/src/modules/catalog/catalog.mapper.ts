import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ImageDto,
  ProductAttributeDto,
  ProductBadge,
  ProductDetailDto,
  ProductOptionDto,
  ProductSummaryDto,
  VariantDto,
} from './catalog.types.js';

/** A product counts as "new" for this many days after publishing (same as the storefront). */
export const NEW_FOR_DAYS = 30;
/** Never reveal exact stock: customers see at most this many units available. */
export const MAX_VISIBLE_QUANTITY = 10;

const mediaSelect = {
  storageKey: true,
  alt: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;

export const productSummarySelect = {
  id: true,
  slug: true,
  name: true,
  publishedAt: true,
  isBestseller: true,
  priceMinMinor: true,
  priceMaxMinor: true,
  compareAtMinor: true,
  inStock: true,
  ratingAverage: true,
  ratingCount: true,
  primaryCategory: { select: { slug: true, name: true } },
  media: {
    orderBy: { position: 'asc' },
    take: 2,
    select: { alt: true, media: { select: mediaSelect } },
  },
  variants: { where: { isActive: true }, take: 2, select: { id: true } },
} satisfies Prisma.ProductSelect;

export type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof productSummarySelect }>;

export const productDetailSelect = {
  ...productSummarySelect,
  shortDescription: true,
  description: true,
  specifications: true,
  sizeGuide: true,
  seoTitle: true,
  seoDescription: true,
  primaryCategory: { select: { slug: true, name: true, path: true } },
  media: {
    orderBy: { position: 'asc' },
    select: { alt: true, variantId: true, media: { select: mediaSelect } },
  },
  attributes: {
    where: { attribute: { isVisible: true } },
    select: {
      textValue: true,
      numberValue: true,
      booleanValue: true,
      attribute: { select: { code: true, name: true, position: true, unit: true } },
      value: { select: { label: true, position: true } },
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      title: true,
      priceMinor: true,
      compareAtPriceMinor: true,
      inventory: {
        select: { onHand: true, reserved: true, trackInventory: true, allowBackorder: true },
      },
      options: {
        select: {
          attribute: { select: { code: true, name: true, position: true } },
          value: { select: { value: true, label: true, swatch: true, position: true } },
        },
      },
    },
  },
  collections: {
    where: { collection: { isActive: true } },
    select: { collection: { select: { slug: true, name: true } } },
  },
  tags: { select: { tag: { select: { slug: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;

type MediaRow = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;
type InventoryRow = NonNullable<ProductDetailRow['variants'][number]['inventory']>;

/** `images/x.jpg` → `https://cdn.example.com/images/x.jpg` (each path segment URL-encoded). */
export function mediaUrl(baseUrl: string, storageKey: string): string {
  return `${baseUrl}/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
}

export function toImage(
  baseUrl: string,
  media: MediaRow,
  altOverride: string | null | undefined,
  fallbackAlt: string,
): ImageDto {
  return {
    url: mediaUrl(baseUrl, media.storageKey),
    alt: altOverride ?? media.alt ?? fallbackAlt,
    width: media.width,
    height: media.height,
  };
}

/** Purchasable units, capped so exact stock levels stay private. */
export function availableQuantity(inventory: InventoryRow | null): number {
  if (!inventory) return 0;
  if (!inventory.trackInventory || inventory.allowBackorder) return MAX_VISIBLE_QUANTITY;
  return Math.max(0, Math.min(MAX_VISIBLE_QUANTITY, inventory.onHand - inventory.reserved));
}

export function badgesFor(
  row: Pick<ProductSummaryRow, 'inStock' | 'compareAtMinor' | 'publishedAt' | 'isBestseller'>,
  now: Date,
): ProductBadge[] {
  if (!row.inStock) return ['sold-out'];
  const badges: ProductBadge[] = [];
  if (row.compareAtMinor !== null) badges.push('sale');
  if (row.publishedAt) {
    const ageDays = (now.getTime() - row.publishedAt.getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays <= NEW_FOR_DAYS) badges.push('new');
  }
  if (row.isBestseller) badges.push('bestseller');
  return badges;
}

export function toProductSummary(
  row: ProductSummaryRow,
  baseUrl: string,
  now: Date,
): ProductSummaryDto {
  const [first, second] = row.media;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: { slug: row.primaryCategory.slug, name: row.primaryCategory.name },
    image: first ? toImage(baseUrl, first.media, first.alt, row.name) : null,
    hoverImage: second ? toImage(baseUrl, second.media, second.alt, row.name) : null,
    priceMinor: row.priceMinMinor ?? 0,
    compareAtPriceMinor: row.compareAtMinor,
    priceVaries: row.priceMinMinor !== row.priceMaxMinor,
    inStock: row.inStock,
    badges: badgesFor(row, now),
    rating: { average: Math.round(row.ratingAverage * 10) / 10, count: row.ratingCount },
    quickAddVariantId:
      row.variants.length === 1 && row.inStock ? (row.variants[0]?.id ?? null) : null,
  };
}

const specificationsSchema = z.array(z.object({ label: z.string(), value: z.string() })).catch([]);

/** Distinct option axes (Size, Shade…) and their values, in attribute / value order. */
function optionsOf(variants: ProductDetailRow['variants']): ProductOptionDto[] {
  const axes = new Map<
    string,
    {
      name: string;
      position: number;
      values: Map<string, { label: string; swatch: string | null; position: number }>;
    }
  >();
  for (const variant of variants) {
    for (const { attribute, value } of variant.options) {
      const axis = axes.get(attribute.code) ?? {
        name: attribute.name,
        position: attribute.position,
        values: new Map(),
      };
      axis.values.set(value.value, {
        label: value.label,
        swatch: value.swatch,
        position: value.position,
      });
      axes.set(attribute.code, axis);
    }
  }
  return [...axes]
    .sort(([, a], [, b]) => a.position - b.position)
    .map(([code, axis]) => ({
      code,
      name: axis.name,
      values: [...axis.values]
        .sort(([, a], [, b]) => a.position - b.position)
        .map(([value, v]) => ({ value, label: v.label, swatch: v.swatch })),
    }));
}

function attributesOf(rows: ProductDetailRow['attributes']): ProductAttributeDto[] {
  const byCode = new Map<
    string,
    { name: string; position: number; values: { label: string; position: number }[] }
  >();
  for (const row of rows) {
    const label =
      row.value?.label ??
      row.textValue ??
      (row.numberValue !== null
        ? `${row.numberValue.toString()}${row.attribute.unit ? ` ${row.attribute.unit}` : ''}`
        : row.booleanValue !== null
          ? row.booleanValue
            ? 'Yes'
            : 'No'
          : null);
    if (label === null) continue;
    const entry = byCode.get(row.attribute.code) ?? {
      name: row.attribute.name,
      position: row.attribute.position,
      values: [],
    };
    entry.values.push({ label, position: row.value?.position ?? 0 });
    byCode.set(row.attribute.code, entry);
  }
  return [...byCode]
    .sort(([, a], [, b]) => a.position - b.position)
    .map(([code, entry]) => ({
      code,
      name: entry.name,
      values: entry.values.sort((a, b) => a.position - b.position).map((v) => v.label),
    }));
}

export function toVariant(variant: ProductDetailRow['variants'][number]): VariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    title: variant.title,
    options: Object.fromEntries(variant.options.map((o) => [o.attribute.code, o.value.value])),
    priceMinor: variant.priceMinor,
    compareAtPriceMinor: variant.compareAtPriceMinor,
    availableQuantity: availableQuantity(variant.inventory),
  };
}

export function toProductDetail(
  row: ProductDetailRow,
  baseUrl: string,
  now: Date,
  breadcrumbs: ProductDetailDto['breadcrumbs'],
): ProductDetailDto {
  return {
    ...toProductSummary(row, baseUrl, now),
    shortDescription: row.shortDescription,
    description: row.description,
    images: row.media.map((m) => toImage(baseUrl, m.media, m.alt, row.name)),
    specifications: specificationsSchema.parse(row.specifications),
    sizeGuide: row.sizeGuide,
    attributes: attributesOf(row.attributes),
    options: optionsOf(row.variants),
    variants: row.variants.map(toVariant),
    breadcrumbs,
    collections: row.collections.map((c) => ({ slug: c.collection.slug, name: c.collection.name })),
    tags: row.tags.map((t) => t.tag.slug),
    seo: { title: row.seoTitle, description: row.seoDescription },
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}
