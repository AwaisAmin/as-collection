/* Staff catalog management: products, variants, stock, images, categories, attributes, brands. */
import type { AdminPage, StaffRefDto } from './common.js';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AttributeType = 'SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
export type AttributeScope = 'PRODUCT' | 'VARIANT';
export type InventoryReason = 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGE' | 'RETURN' | 'SALE';

/** An image reference on a category, brand or list row. */
export interface AdminImageRefDto {
  id: string;
  url: string;
  alt: string | null;
}

// ─── Products (`/admin/products`) ───

export interface AdminProductListItemDto {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  category: { id: string; name: string };
  /** Null until the product has an active variant. */
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  inStock: boolean;
  isFeatured: boolean;
  isBestseller: boolean;
  image: { url: string; alt: string | null } | null;
  variantCount: number;
  /** Units available across tracked active variants (null when nothing is tracked). */
  stock: number | null;
  lowStockVariants: number;
  updatedAt: string;
  publishedAt: string | null;
}

export type AdminProductListDto = AdminPage<AdminProductListItemDto>;

export interface AdminInventoryDto {
  onHand: number;
  reserved: number;
  /** onHand − reserved. */
  available: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  isLow: boolean;
  updatedAt: string;
}

export interface AdminVariantDto {
  id: string;
  sku: string;
  title: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  costMinor: number | null;
  barcode: string | null;
  weightGrams: number | null;
  isActive: boolean;
  position: number;
  options: { attributeId: string; attribute: string; valueId: string; value: string }[];
  inventory: AdminInventoryDto | null;
  /** Ordered before: can be deactivated, not deleted. */
  hasOrders: boolean;
}

/** Same shape as the write input, so a form can send it straight back. */
export interface ProductAttributeValueDto {
  attributeId: string;
  valueIds?: string[];
  text?: string;
  number?: number;
  boolean?: boolean;
}

export interface AdminProductMediaDto {
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  /** Alt text for this product (overrides the image's own). */
  alt: string | null;
  mediaAlt: string | null;
  variantSku: string | null;
}

export interface AdminProductDto {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  primaryCategory: { id: string; name: string; slug: string };
  categories: { id: string; name: string; slug: string }[];
  brand: { id: string; name: string } | null;
  specifications: { label: string; value: string }[];
  sizeGuide: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: { slug: string; name: string }[];
  attributes: ProductAttributeValueDto[];
  variants: AdminVariantDto[];
  media: AdminProductMediaDto[];
  summary: {
    priceMinMinor: number | null;
    priceMaxMinor: number | null;
    inStock: boolean;
    ratingAverage: number;
    ratingCount: number;
    orders: number;
    reviews: number;
  };
  publishedAt: string | null;
  createdAt: string;
  /** Send back as `updatedAt` when saving (conflict detection). */
  updatedAt: string;
}

// ─── Images (`/admin/media`) ───

export interface AdminMediaDto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  mimeType: string;
  sizeBytes: number;
  /** Responsive copies, ascending width. */
  variants: { width: number; height: number; url: string }[];
  usage: { products: number; categories: number; brands: number; collections: number };
  uploadedBy: StaffRefDto | null;
  createdAt: string;
}

export interface AdminMediaListDto {
  items: AdminMediaDto[];
  /** Pass as `before` for the next page; null on the last page. */
  nextCursor: string | null;
}

// ─── Taxonomy ───

/** Text over a category's banner image on its shop page. */
export interface CategoryBannerDto {
  eyebrow?: string | null;
  description?: string | null;
  /** CSS object-position of the banner image, e.g. "50% 30%". */
  focus?: string | null;
}

export interface AdminCategoryDto {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  /** 0 for top-level categories. */
  depth: number;
  position: number;
  isActive: boolean;
  image: AdminImageRefDto | null;
  bannerImage: AdminImageRefDto | null;
  banner: CategoryBannerDto | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Filters shown on the category page; `isRequired`: products here must fill it in. */
  attributes: { attributeId: string; name: string; isRequired: boolean }[];
  counts: {
    children: number;
    /** Products whose main category this is. */
    products: number;
    /** Products listed here as an extra category. */
    extraProducts: number;
  };
  /** Send back as `updatedAt` when saving (conflict detection). */
  updatedAt: string;
}

export interface AdminCategoryNodeDto extends AdminCategoryDto {
  children: AdminCategoryNodeDto[];
}

export interface AdminAttributeDto {
  id: string;
  /** Filter parameter: `?f.<code>=<value>`. */
  code: string;
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  isFilterable: boolean;
  isVisible: boolean;
  unit: string | null;
  position: number;
  values: {
    id: string;
    value: string;
    label: string;
    swatch: string | null;
    position: number;
    usage: number;
  }[];
  usage: { products: number; variants: number; categories: number };
  updatedAt: string;
}

export interface AdminBrandDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  logo: AdminImageRefDto | null;
  /** Products of this brand. */
  products: number;
  updatedAt: string;
}

// ─── Stock (`/admin/inventory`) ───

export type StockFilter = 'all' | 'low' | 'out' | 'backorder';

export interface AdminStockItemDto {
  variantId: string;
  sku: string;
  title: string | null;
  isActive: boolean;
  product: { id: string; name: string; status: ProductStatus };
  onHand: number;
  /** Held by open orders. */
  reserved: number;
  /** onHand − reserved (negative when backordered). */
  available: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  updatedAt: string;
}

export type AdminStockListDto = AdminPage<AdminStockItemDto>;

/** `POST /admin/inventory/adjustments` — all lines applied, or none (422). */
export interface StockAdjustResultDto {
  changed: { variantId: string; sku: string; onHand: number; delta: number; available: number }[];
  /** Lines that asked for no change. */
  unchanged: number;
}

export interface StockSettingsResultDto {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

export interface StockMovementDto {
  id: string;
  delta: number;
  reason: InventoryReason;
  /** e.g. the order number of a sale, or a supplier invoice. */
  reference: string | null;
  note: string | null;
  createdAt: string;
  by: StaffRefDto | null;
}

export interface StockMovementListDto {
  items: StockMovementDto[];
  nextCursor: string | null;
}

// ─── Collections (`/admin/collections`) ───

export type CollectionType = 'MANUAL' | 'AUTOMATED';
/** Whether shoppers see it now (inactive, before its start, after its end, or live). */
export type CollectionState = 'live' | 'scheduled' | 'ended' | 'hidden';

/** One condition of an automated collection. Slugs: tags, attribute codes and value slugs. */
export type CollectionRuleDto =
  | { field: 'onSale' | 'inStock' | 'featured'; op: 'eq'; value: boolean }
  | { field: 'tag'; op: 'in'; value: string[] }
  | { field: 'attribute'; op: 'in'; code: string; value: string[] }
  | { field: 'priceMinor'; op: 'lte' | 'gte'; value: number }
  | { field: 'publishedWithinDays'; op: 'lte'; value: number };

/** Every rule must match (`all`) or at least one (`any`). */
export type CollectionRulesDto = { all: CollectionRuleDto[] } | { any: CollectionRuleDto[] };

export interface AdminCollectionDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: CollectionType;
  rules: CollectionRulesDto | null;
  isActive: boolean;
  state: CollectionState;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: AdminImageRefDto | null;
  /** Hand-picked: products in the list; automated: live products matching the rules now. */
  productCount: number;
  updatedAt: string;
}

/** A product as collections list it (picked products, rule previews). */
export interface CollectionProductDto {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  priceMinMinor: number | null;
  image: { url: string; alt: string | null } | null;
}

export interface AdminCollectionDetailDto extends AdminCollectionDto {
  /** Hand-picked collections: the products in display order (empty for automated). */
  products: CollectionProductDto[];
}

/** `POST /admin/collections/preview` — what the rules match right now. */
export interface CollectionPreviewDto {
  count: number;
  /** The newest few. */
  sample: CollectionProductDto[];
}
