import type { CategorySlug } from '@/config/catalog';

/** Prices are whole PKR (no paisa) — avoids floating-point money bugs. */
export type Money = number;

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductOptionValue {
  value: string;
  /** CSS color for shade/colour swatches. */
  swatch?: string;
}

/** e.g. { name: 'Size', values: [{ value: 'S' }, …] } */
export interface ProductOption {
  name: string;
  values: readonly ProductOptionValue[];
}

/** A purchasable combination of option values (one SKU). */
export interface ProductVariant {
  id: string;
  sku: string;
  /** e.g. { Size: 'M' }. Empty for single-variant products. */
  options: Readonly<Record<string, string>>;
  price: Money;
  /** Original price when on sale. */
  compareAtPrice?: Money;
  stock: number;
}

export interface ProductDetail {
  label: string;
  value: string;
}

export type ProductBadge = 'new' | 'sale' | 'bestseller' | 'sold-out';

export interface RatingSummary {
  average: number;
  count: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  shortDescription: string;
  /** Paragraphs. */
  description: readonly string[];
  images: readonly ProductImage[];
  options: readonly ProductOption[];
  variants: readonly ProductVariant[];
  details: readonly ProductDetail[];
  tags: readonly string[];
  /** Which size chart applies (stitched garments). */
  sizeGuide?: 'stitched';
  featured?: boolean;
  bestseller?: boolean;
  rating: RatingSummary;
  /** ISO date. */
  createdAt: string;
}

/** Lightweight shape for grids, cards, wishlist, search results. */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  image: ProductImage;
  hoverImage?: ProductImage;
  price: Money;
  compareAtPrice?: Money;
  /** True when variants have different prices ("From Rs …"). */
  priceVaries: boolean;
  inStock: boolean;
  badges: readonly ProductBadge[];
  rating: RatingSummary;
  /** Default variant id for one-click add to cart (single-variant products). */
  quickAddVariantId?: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  city?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  /** ISO date. */
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

export interface ReviewSummary extends RatingSummary {
  /** Count per star, index 0 = 1★ … index 4 = 5★. */
  distribution: readonly [number, number, number, number, number];
}

export interface Paginated<T> {
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface FacetValue {
  value: string;
  count: number;
  swatch?: string;
}

export interface CatalogFacets {
  priceRange: { min: Money; max: Money };
  options: readonly { name: string; values: readonly FacetValue[] }[];
}

/** Current server-side price/stock for a variant (cart re-validation, checkout). */
export interface VariantSnapshot {
  variantId: string;
  price: Money;
  compareAtPrice?: Money;
  stock: number;
}
