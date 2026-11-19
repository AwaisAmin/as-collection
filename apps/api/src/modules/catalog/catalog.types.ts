/*
 * Public catalog API responses. Money is always integer minor units (paisa) of the store currency.
 */

export interface ImageDto {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

export type ProductBadge = 'new' | 'sale' | 'bestseller' | 'sold-out';

export interface RatingDto {
  /** 0–5, one decimal. */
  average: number;
  count: number;
}

export interface CategoryRefDto {
  slug: string;
  name: string;
}

export interface ProductSummaryDto {
  id: string;
  slug: string;
  name: string;
  category: CategoryRefDto;
  image: ImageDto | null;
  hoverImage: ImageDto | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  /** Variants have different prices → show "From …". */
  priceVaries: boolean;
  inStock: boolean;
  badges: ProductBadge[];
  rating: RatingDto;
  /** Set for single-variant, in-stock products: add to cart without choosing options. */
  quickAddVariantId: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface OptionValueDto {
  value: string;
  label: string;
  swatch: string | null;
}

export interface ProductOptionDto {
  code: string;
  name: string;
  values: OptionValueDto[];
}

export interface VariantDto {
  id: string;
  sku: string;
  title: string | null;
  /** attributeCode → value slug, e.g. { size: 'm' }. */
  options: Record<string, string>;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  /** Units purchasable now, capped (exact stock levels are not exposed). */
  availableQuantity: number;
}

export interface ProductAttributeDto {
  code: string;
  name: string;
  values: string[];
}

export interface ProductDetailDto extends ProductSummaryDto {
  shortDescription: string | null;
  description: string | null;
  images: ImageDto[];
  specifications: { label: string; value: string }[];
  sizeGuide: string | null;
  attributes: ProductAttributeDto[];
  options: ProductOptionDto[];
  variants: VariantDto[];
  breadcrumbs: CategoryRefDto[];
  collections: CategoryRefDto[];
  tags: string[];
  seo: { title: string | null; description: string | null };
  publishedAt: string | null;
}

export interface FacetValueDto extends OptionValueDto {
  count: number;
}

export interface AttributeFacetDto {
  code: string;
  name: string;
  scope: 'PRODUCT' | 'VARIANT';
  values: FacetValueDto[];
}

export interface FacetsDto {
  total: number;
  priceRange: { minMinor: number; maxMinor: number };
  attributes: AttributeFacetDto[];
  collections: (CategoryRefDto & { count: number })[];
}

export interface CategoryNodeDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: ImageDto | null;
  children: CategoryNodeDto[];
}

export interface CategoryDetailDto extends Omit<CategoryNodeDto, 'children'> {
  banner: { eyebrow?: string; description?: string; focus?: string; image: ImageDto | null } | null;
  breadcrumbs: CategoryRefDto[];
  children: CategoryRefDto[];
  /** Filterable attributes for this category, including those inherited from its ancestors. */
  filters: { code: string; name: string; scope: 'PRODUCT' | 'VARIANT' }[];
  seo: { title: string | null; description: string | null };
}

export interface CollectionDto {
  slug: string;
  name: string;
  description: string | null;
  image: ImageDto | null;
  type: 'MANUAL' | 'AUTOMATED';
  endsAt: string | null;
}

export interface VariantSnapshotDto {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  title: string | null;
  options: Record<string, string>;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  availableQuantity: number;
  /** False when the product or variant is no longer for sale. */
  purchasable: boolean;
  image: ImageDto | null;
}
