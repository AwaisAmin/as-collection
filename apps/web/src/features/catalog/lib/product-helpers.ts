import type {
  Money,
  Product,
  ProductBadge,
  ProductSummary,
  ProductVariant,
  RatingSummary,
  Review,
  ReviewSummary,
} from '../types';

const NEW_FOR_DAYS = 30;

export function minPrice(product: Pick<Product, 'variants'>): Money {
  return Math.min(...product.variants.map((v) => v.price));
}

export function isInStock(product: Pick<Product, 'variants'>): boolean {
  return product.variants.some((v) => v.stock > 0);
}

/** Highest compare-at price among the cheapest variants, if it's actually a discount. */
export function compareAtFor(product: Pick<Product, 'variants'>): Money | undefined {
  const min = minPrice(product);
  const compare = product.variants
    .filter((v) => v.price === min)
    .map((v) => v.compareAtPrice ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return compare > min ? compare : undefined;
}

export function discountPercent(price: Money, compareAt?: Money): number | undefined {
  if (!compareAt || compareAt <= price) return undefined;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function isNew(createdAt: string, now: Date = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(createdAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= NEW_FOR_DAYS;
}

export function badgesFor(product: Product, now?: Date): ProductBadge[] {
  const badges: ProductBadge[] = [];
  if (!isInStock(product)) return ['sold-out'];
  if (compareAtFor(product)) badges.push('sale');
  if (isNew(product.createdAt, now)) badges.push('new');
  if (product.bestseller) badges.push('bestseller');
  return badges;
}

export function toSummary(product: Product, now?: Date): ProductSummary {
  const prices = new Set(product.variants.map((v) => v.price));
  const [image, hoverImage] = product.images;
  const single = product.variants.length === 1 ? product.variants[0] : undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    image: image ?? { src: '/images/hero-model.jpg', alt: product.name },
    hoverImage,
    price: minPrice(product),
    compareAtPrice: compareAtFor(product),
    priceVaries: prices.size > 1,
    inStock: isInStock(product),
    badges: badgesFor(product, now),
    rating: product.rating,
    quickAddVariantId: single && single.stock > 0 ? single.id : undefined,
  };
}

/** Variant matching every selected option (e.g. { Size: 'M' }). */
export function findVariant(
  product: Pick<Product, 'variants'>,
  selected: Readonly<Record<string, string>>,
): ProductVariant | undefined {
  return product.variants.find((v) =>
    Object.entries(v.options).every(([name, value]) => selected[name] === value),
  );
}

export function summarizeReviews(reviews: readonly Review[]): ReviewSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of reviews) {
    distribution[r.rating - 1] = (distribution[r.rating - 1] ?? 0) + 1;
    sum += r.rating;
  }
  const count = reviews.length;
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
  };
}

export function toRatingSummary(summary: ReviewSummary): RatingSummary {
  return { average: summary.average, count: summary.count };
}
