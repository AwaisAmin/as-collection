import type {
  FacetsDto,
  FeaturedReviewDto,
  ImageDto,
  ProductDetailDto,
  ProductSummaryDto,
  ReviewDto,
  ReviewSummaryDto,
  VariantSnapshotDto,
} from '@as/contracts';

import { type CategorySlug, categorySlugs, isCategorySlug } from '@/config/catalog';
import { isOccasion, occasionSlugs } from '@/config/occasions';

import type { CatalogQuery } from '../schemas';
import type {
  CatalogFacets,
  FeaturedReview,
  Money,
  Product,
  ProductImage,
  ProductSummary,
  Review,
  ReviewSummary,
  VariantDetail,
} from '../types';

/*
 * API responses (contracts, paisa, attribute codes/slugs) → the storefront's domain types (whole
 * rupees, option names/labels). Pure functions: no I/O, unit-tested.
 */

/** The storefront shows whole rupees; store prices are whole rupees, so nothing is lost. */
export const toRupees = (minor: number): Money => Math.round(minor / 100);
export const toMinor = (rupees: number): number => Math.round(rupees * 100);

/** Option attributes the storefront filters by (URL param → attribute code). */
export const OPTION_FILTERS = { size: 'size', shade: 'shade' } as const;
const OPTION_NAMES: Record<string, string> = { size: 'Size', shade: 'Shade' };

/** Images served by this site itself become paths (next/image optimises them locally). */
export function toImageSrc(url: string, siteOrigin: string): string {
  return url.startsWith(`${siteOrigin}/`) ? url.slice(siteOrigin.length) : url;
}

const PLACEHOLDER: ProductImage = { src: '/images/hero-model.jpg', alt: '' };

export function toImage(
  dto: ImageDto | null | undefined,
  siteOrigin: string,
  fallbackAlt = '',
): ProductImage {
  if (!dto) return { ...PLACEHOLDER, alt: fallbackAlt };
  return { src: toImageSrc(dto.url, siteOrigin), alt: dto.alt || fallbackAlt };
}

/** The storefront's three departments; deeper categories roll up to their department. */
function toCategory(...slugs: (string | undefined)[]): CategorySlug {
  return (
    slugs.find((s): s is CategorySlug => s !== undefined && isCategorySlug(s)) ?? categorySlugs[0]
  );
}

export function toSummary(dto: ProductSummaryDto, siteOrigin: string): ProductSummary {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    category: toCategory(dto.category.slug),
    image: toImage(dto.image, siteOrigin, dto.name),
    ...(dto.hoverImage ? { hoverImage: toImage(dto.hoverImage, siteOrigin, dto.name) } : {}),
    price: toRupees(dto.priceMinor),
    ...(dto.compareAtPriceMinor ? { compareAtPrice: toRupees(dto.compareAtPriceMinor) } : {}),
    priceVaries: dto.priceVaries,
    inStock: dto.inStock,
    badges: dto.badges,
    rating: dto.rating,
    ...(dto.quickAddVariantId ? { quickAddVariantId: dto.quickAddVariantId } : {}),
  };
}

/** "Para one.\n\nPara two." → paragraphs. */
const paragraphs = (text: string | null) =>
  (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export function toProduct(dto: ProductDetailDto, siteOrigin: string): Product {
  // attribute code → { name, value slug → label }
  const options = new Map(
    dto.options.map((o) => [
      o.code,
      { name: o.name, labels: new Map(o.values.map((v) => [v.value, v.label])) },
    ]),
  );
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    category: toCategory(dto.breadcrumbs[0]?.slug, dto.category.slug),
    shortDescription: dto.shortDescription ?? '',
    description: paragraphs(dto.description),
    images: dto.images.length
      ? dto.images.map((i) => toImage(i, siteOrigin, dto.name))
      : [toImage(null, siteOrigin, dto.name)],
    options: dto.options.map((o) => ({
      name: o.name,
      values: o.values.map((v) => ({ value: v.label, ...(v.swatch ? { swatch: v.swatch } : {}) })),
    })),
    variants: dto.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      options: Object.fromEntries(
        Object.entries(v.options).map(([code, value]) => {
          const option = options.get(code);
          return [option?.name ?? code, option?.labels.get(value) ?? value];
        }),
      ),
      price: toRupees(v.priceMinor),
      ...(v.compareAtPriceMinor ? { compareAtPrice: toRupees(v.compareAtPriceMinor) } : {}),
      stock: v.availableQuantity,
    })),
    details: dto.specifications,
    tags: dto.tags,
    occasions: dto.collections.map((c) => c.slug).filter(isOccasion),
    ...(dto.sizeGuide === 'stitched' ? { sizeGuide: 'stitched' as const } : {}),
    bestseller: dto.badges.includes('bestseller'),
    rating: dto.rating,
    createdAt: dto.publishedAt ?? new Date(0).toISOString(),
  };
}

/** Label ↔ value-slug lookup for one option attribute (filters use labels in the URL). */
export type OptionValueIndex = ReadonlyMap<string, string>;

export function toFacets(dto: FacetsDto): CatalogFacets {
  const occasionCounts = new Map(dto.collections.map((c) => [c.slug, c.count]));
  return {
    priceRange: { min: toRupees(dto.priceRange.minMinor), max: toRupees(dto.priceRange.maxMinor) },
    options: dto.attributes
      .filter((a) => a.code in OPTION_NAMES)
      .map((a) => ({
        name: OPTION_NAMES[a.code] ?? a.name,
        values: a.values.map((v) => ({
          value: v.label,
          count: v.count,
          ...(v.swatch ? { swatch: v.swatch } : {}),
        })),
      })),
    occasions: occasionSlugs.flatMap((slug) => {
      const count = occasionCounts.get(slug) ?? 0;
      return count ? [{ slug, count }] : [];
    }),
  };
}

/** label → value slug, per option code, from catalog-wide facets. */
export function optionIndex(dto: FacetsDto): Record<string, OptionValueIndex> {
  return Object.fromEntries(
    dto.attributes.map((a) => [a.code, new Map(a.values.map((v) => [v.label, v.value]))]),
  );
}

/** Unknown labels fall back to their slug form (the API's default for new values). */
const valueSlug = (label: string, index: OptionValueIndex | undefined) =>
  index?.get(label) ??
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Storefront query → `GET /catalog/products` parameters. */
export function toListParams(
  query: CatalogQuery,
  pageSize: number,
  index: Record<string, OptionValueIndex>,
): Record<string, string | number | boolean | string[] | undefined> {
  return {
    category: query.category,
    q: query.q || undefined,
    sort: query.sort,
    min: query.min !== undefined ? toMinor(query.min) : undefined,
    max: query.max !== undefined ? toMinor(query.max) : undefined,
    inStock: query.inStock,
    sale: query.sale,
    collection: query.occasion,
    [`f.${OPTION_FILTERS.size}`]: query.size.map((v) => valueSlug(v, index[OPTION_FILTERS.size])),
    [`f.${OPTION_FILTERS.shade}`]: query.shade.map((v) =>
      valueSlug(v, index[OPTION_FILTERS.shade]),
    ),
    page: query.page,
    pageSize,
  };
}

export function toVariantDetail(dto: VariantSnapshotDto, siteOrigin: string): VariantDetail {
  return {
    variantId: dto.variantId,
    price: toRupees(dto.priceMinor),
    ...(dto.compareAtPriceMinor ? { compareAtPrice: toRupees(dto.compareAtPriceMinor) } : {}),
    // Not purchasable (archived, deactivated) counts as sold out for the cart.
    stock: dto.purchasable ? dto.availableQuantity : 0,
    productId: dto.productId,
    slug: dto.productSlug,
    name: dto.productName,
    sku: dto.sku,
    options: dto.optionLabels,
    image: toImage(dto.image, siteOrigin, dto.productName),
  };
}

// ─── Reviews ───

const toRating = (n: number): Review['rating'] =>
  Math.min(5, Math.max(1, Math.round(n))) as Review['rating'];

export function toReview(dto: ReviewDto): Review {
  return {
    id: dto.id,
    productId: dto.productId,
    author: dto.author,
    ...(dto.city ? { city: dto.city } : {}),
    rating: toRating(dto.rating),
    title: dto.title,
    body: dto.body,
    createdAt: dto.createdAt,
    verifiedPurchase: dto.verifiedPurchase,
    helpfulCount: dto.helpfulCount,
    ...(dto.reply ? { reply: dto.reply } : {}),
  };
}

export const toFeaturedReview = (dto: FeaturedReviewDto): FeaturedReview => ({
  ...toReview(dto),
  product: dto.product,
});

export const toReviewSummary = (dto: ReviewSummaryDto): ReviewSummary => ({
  average: dto.average,
  count: dto.count,
  distribution: dto.distribution,
});
