import type {
  AdminProductDto,
  AdminVariantDto,
  ProductAttributeValueDto,
  ProductStatus,
} from '@as/contracts';

/*
 * The product editor's working copy. Money is typed in rupees (strings, exactly as entered) and
 * sent to the API in paisa; lists are sent whole (the API replaces them).
 */

export interface DraftImage {
  mediaId: string;
  url: string;
  /** This product's alt text ('' = use the image's own). */
  alt: string;
  mediaAlt: string | null;
  variantSku: string;
}

export interface DraftSpec {
  key: string;
  label: string;
  value: string;
}

export interface DraftVariant {
  key: string;
  sku: string;
  title: string;
  price: string;
  compareAt: string;
  cost: string;
  /** Initial stock (new products only; later changes go through stock adjustments). */
  stock: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  /** attributeId → valueId */
  options: Record<string, string>;
}

export interface ProductDraft {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  primaryCategoryId: string;
  categoryIds: string[];
  brandId: string;
  tags: string;
  isFeatured: boolean;
  isBestseller: boolean;
  seoTitle: string;
  seoDescription: string;
  specifications: DraftSpec[];
  /** attributeId → value */
  attributes: Record<string, ProductAttributeValueDto>;
  images: DraftImage[];
  /** Variant option types used by this product (new products). */
  optionAttributeIds: string[];
  variants: DraftVariant[];
}

let counter = 0;
/** Stable React keys for rows added in the browser. */
export const newKey = () => `k${String(++counter)}`;

/** `1,250.50` / `1250.5` → 125050 paisa; '' → null; anything else → NaN. */
export function rupeesToMinor(input: string): number | null {
  const clean = input.replace(/[,\s]/g, '').replace(/^Rs\.?/i, '');
  if (clean === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  const [whole = '0', fraction = ''] = clean.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** 125050 → `1250.50`, 125000 → `1250`. */
export function minorToRupees(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  const whole = Math.trunc(minor / 100);
  const fraction = Math.abs(minor % 100);
  return fraction ? `${String(whole)}.${String(fraction).padStart(2, '0')}` : String(whole);
}

export const emptyVariant = (): DraftVariant => ({
  key: newKey(),
  sku: '',
  title: '',
  price: '',
  compareAt: '',
  cost: '',
  stock: '0',
  trackInventory: true,
  allowBackorder: false,
  options: {},
});

export function emptyDraft(): ProductDraft {
  return {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    status: 'DRAFT',
    primaryCategoryId: '',
    categoryIds: [],
    brandId: '',
    tags: '',
    isFeatured: false,
    isBestseller: false,
    seoTitle: '',
    seoDescription: '',
    specifications: [],
    attributes: {},
    images: [],
    optionAttributeIds: [],
    variants: [emptyVariant()],
  };
}

export function draftFromProduct(product: AdminProductDto): ProductDraft {
  return {
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    status: product.status,
    primaryCategoryId: product.primaryCategory.id,
    categoryIds: product.categories
      .map((c) => c.id)
      .filter((id) => id !== product.primaryCategory.id),
    brandId: product.brand?.id ?? '',
    tags: product.tags.map((t) => t.name).join(', '),
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    specifications: product.specifications.map((s) => ({ key: newKey(), ...s })),
    attributes: Object.fromEntries(product.attributes.map((a) => [a.attributeId, a])),
    images: product.media.map((m) => ({
      mediaId: m.mediaId,
      url: m.url,
      alt: m.alt ?? '',
      mediaAlt: m.mediaAlt,
      variantSku: m.variantSku ?? '',
    })),
    optionAttributeIds: [],
    variants: [],
  };
}

/** Whether an attribute entry carries a value worth sending. */
export function hasValue(entry: ProductAttributeValueDto): boolean {
  return Boolean(
    entry.valueIds?.length ||
    (entry.text !== undefined && entry.text.trim() !== '') ||
    entry.number !== undefined ||
    entry.boolean !== undefined,
  );
}

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Product fields shared by create and update. */
function productFields(draft: ProductDraft) {
  return {
    name: draft.name.trim(),
    shortDescription: textOrNull(draft.shortDescription),
    description: textOrNull(draft.description),
    status: draft.status,
    primaryCategoryId: draft.primaryCategoryId,
    categoryIds: draft.categoryIds.filter((id) => id !== draft.primaryCategoryId),
    brandId: draft.brandId || null,
    tags: [
      ...new Set(
        draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
    isFeatured: draft.isFeatured,
    isBestseller: draft.isBestseller,
    seoTitle: textOrNull(draft.seoTitle),
    seoDescription: textOrNull(draft.seoDescription),
    specifications: draft.specifications
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label || s.value),
    attributes: Object.values(draft.attributes)
      .filter(hasValue)
      .map((a) => ({ ...a, ...(a.text !== undefined ? { text: a.text.trim() } : {}) })),
    media: draft.images.map((image) => ({
      mediaId: image.mediaId,
      ...(image.alt.trim() ? { alt: image.alt.trim() } : {}),
      ...(image.variantSku ? { variantSku: image.variantSku } : {}),
    })),
  };
}

/** Money field → paisa for the API; invalid input becomes -1 so the API reports the field. */
const money = (value: string) => {
  const minor = rupeesToMinor(value);
  return minor === null ? null : Number.isNaN(minor) ? -1 : minor;
};

const count = (value: string) => {
  const n = Number(value.trim() || '0');
  return Number.isInteger(n) ? n : -1;
};

export function variantPayload(variant: DraftVariant, optionAttributeIds: readonly string[]) {
  return {
    sku: variant.sku.trim(),
    title: textOrNull(variant.title),
    priceMinor: money(variant.price) ?? -1,
    compareAtPriceMinor: money(variant.compareAt),
    costMinor: money(variant.cost),
    options: optionAttributeIds.flatMap((attributeId) => {
      const valueId = variant.options[attributeId];
      return valueId ? [{ attributeId, valueId }] : [];
    }),
  };
}

export function createPayload(draft: ProductDraft) {
  return {
    ...productFields(draft),
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    variants: draft.variants.map((variant) => ({
      ...variantPayload(variant, draft.optionAttributeIds),
      inventory: {
        onHand: count(variant.stock),
        trackInventory: variant.trackInventory,
        allowBackorder: variant.allowBackorder,
      },
    })),
  };
}

export function updatePayload(draft: ProductDraft, updatedAt: string) {
  return { ...productFields(draft), slug: draft.slug.trim(), updatedAt };
}

/** A variant row as the variant editor's draft (edit mode). */
export function draftFromVariant(variant: AdminVariantDto): DraftVariant {
  return {
    key: variant.id,
    sku: variant.sku,
    title: variant.title ?? '',
    price: minorToRupees(variant.priceMinor),
    compareAt: minorToRupees(variant.compareAtPriceMinor),
    cost: minorToRupees(variant.costMinor),
    stock: String(variant.inventory?.onHand ?? 0),
    trackInventory: variant.inventory?.trackInventory ?? true,
    allowBackorder: variant.inventory?.allowBackorder ?? false,
    options: Object.fromEntries(variant.options.map((o) => [o.attributeId, o.valueId])),
  };
}
