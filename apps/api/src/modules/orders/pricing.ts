import type { QuoteDto } from '@as/contracts';
/*
 * Pure checkout pricing: lines → priced quote (stock problems, coupon, shipping, totals). The
 * client's prices are never used — only variant ids and quantities. Amounts are integer paisa.
 */

/** Customers never see more availability than this (exact stock stays private). */
export const MAX_VISIBLE_QUANTITY = 10;
/** Units of one variant per order (also stops one shopper reserving all stock). */
export const MAX_QUANTITY_PER_LINE = 10;

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface PricedVariant {
  id: string;
  sku: string;
  title: string | null;
  productId: string;
  productSlug: string;
  productName: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  /** Variant active and product published. */
  sellable: boolean;
  image: { url: string; alt: string } | null;
  inventory: { onHand: number; reserved: number; tracked: boolean; backorder: boolean } | null;
}

export type LineProblem = 'UNAVAILABLE' | 'INSUFFICIENT_STOCK';

export interface QuoteLine {
  variantId: string;
  quantity: number;
  productId: string | null;
  productSlug: string | null;
  productName: string | null;
  variantTitle: string | null;
  sku: string | null;
  image: { url: string; alt: string } | null;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  lineTotalMinor: number;
  /** Capped at MAX_VISIBLE_QUANTITY. */
  availableQuantity: number;
  problem: LineProblem | null;
}

export interface ShippingRules {
  flatFeeMinor: number;
  freeShippingThresholdMinor: number;
}

export interface DiscountRule {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  /** Basis points for PERCENTAGE (1500 = 15 %), paisa for FIXED_AMOUNT. */
  value: number;
  minSubtotalMinor: number | null;
  maxDiscountMinor: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  isActive: boolean;
}

export type DiscountRejection =
  'NOT_FOUND' | 'INACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'MIN_SUBTOTAL' | 'USAGE_LIMIT';

export type DiscountResult =
  | { applied: true; code: string; discountMinor: number; freeShipping: boolean }
  | { applied: false; code: string; reason: DiscountRejection; minSubtotalMinor?: number };

/** Same shape as the public `QuoteDto` contract (checked below). */
export interface Quote {
  lines: QuoteLine[];
  itemCount: number;
  subtotalMinor: number;
  /** Compare-at savings already in the prices (shown as "You save"). */
  savingsMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: 'PKR';
  discount: DiscountResult | null;
  freeShippingThresholdMinor: number;
  freeShippingRemainingMinor: number;
  /** No line has a problem and the cart is not empty. */
  purchasable: boolean;
}

/** Merges duplicate variants (quantities add up, capped per line), keeping first-seen order. */
export function normalizeLines(lines: readonly CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of lines) {
    merged.set(variantId, Math.min(MAX_QUANTITY_PER_LINE, (merged.get(variantId) ?? 0) + quantity));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Units that can be sold now (∞ when stock is not tracked or backorders are allowed). */
export function sellableUnits(inventory: PricedVariant['inventory']): number {
  if (!inventory) return 0;
  if (!inventory.tracked || inventory.backorder) return Number.POSITIVE_INFINITY;
  return Math.max(0, inventory.onHand - inventory.reserved);
}

export function evaluateDiscount(
  rule: DiscountRule | null,
  requestedCode: string,
  subtotalMinor: number,
  now: Date,
): DiscountResult {
  const code = rule?.code ?? requestedCode;
  const reject = (reason: DiscountRejection, extra: { minSubtotalMinor?: number } = {}) => ({
    applied: false as const,
    code,
    reason,
    ...extra,
  });
  if (!rule) return reject('NOT_FOUND');
  if (!rule.isActive) return reject('INACTIVE');
  if (rule.startsAt && rule.startsAt > now) return reject('NOT_STARTED');
  if (rule.endsAt && rule.endsAt <= now) return reject('EXPIRED');
  if (rule.usageLimit !== null && rule.usageCount >= rule.usageLimit) return reject('USAGE_LIMIT');
  if (rule.minSubtotalMinor !== null && subtotalMinor < rule.minSubtotalMinor) {
    return reject('MIN_SUBTOTAL', { minSubtotalMinor: rule.minSubtotalMinor });
  }

  let discountMinor = 0;
  // Whole rupees, rounded down: the shop shows and confirms totals in rupees, so a paisa
  // remainder (15 % of Rs 1,290 = Rs 193.50) would never match the total the shopper saw.
  if (rule.type === 'PERCENTAGE') {
    discountMinor = Math.floor((subtotalMinor * rule.value) / 10_000 / 100) * 100;
  }
  if (rule.type === 'FIXED_AMOUNT') discountMinor = rule.value;
  if (rule.maxDiscountMinor !== null)
    discountMinor = Math.min(discountMinor, rule.maxDiscountMinor);
  discountMinor = Math.max(0, Math.min(discountMinor, subtotalMinor));
  return { applied: true, code, discountMinor, freeShipping: rule.type === 'FREE_SHIPPING' };
}

export interface QuoteInput {
  lines: readonly CartLineInput[];
  variants: ReadonlyMap<string, PricedVariant>;
  shipping: ShippingRules;
  discount?: { code: string; rule: DiscountRule | null };
  now: Date;
}

export function buildQuote({ lines, variants, shipping, discount, now }: QuoteInput): Quote {
  const quoteLines = normalizeLines(lines).map((line): QuoteLine => {
    const variant = variants.get(line.variantId);
    if (!variant?.sellable) {
      return {
        variantId: line.variantId,
        quantity: line.quantity,
        productId: variant?.productId ?? null,
        productSlug: variant?.productSlug ?? null,
        productName: variant?.productName ?? null,
        variantTitle: variant?.title ?? null,
        sku: variant?.sku ?? null,
        image: variant?.image ?? null,
        unitPriceMinor: 0,
        compareAtPriceMinor: null,
        lineTotalMinor: 0,
        availableQuantity: 0,
        problem: 'UNAVAILABLE',
      };
    }
    const units = sellableUnits(variant.inventory);
    return {
      variantId: variant.id,
      quantity: line.quantity,
      productId: variant.productId,
      productSlug: variant.productSlug,
      productName: variant.productName,
      variantTitle: variant.title,
      sku: variant.sku,
      image: variant.image,
      unitPriceMinor: variant.priceMinor,
      compareAtPriceMinor: variant.compareAtPriceMinor,
      lineTotalMinor: variant.priceMinor * line.quantity,
      availableQuantity: Math.min(MAX_VISIBLE_QUANTITY, units),
      problem: units === 0 ? 'UNAVAILABLE' : units < line.quantity ? 'INSUFFICIENT_STOCK' : null,
    };
  });

  const priced = quoteLines.filter((l) => l.problem !== 'UNAVAILABLE');
  const itemCount = priced.reduce((sum, l) => sum + l.quantity, 0);
  const subtotalMinor = priced.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const savingsMinor = priced.reduce(
    (sum, l) =>
      sum +
      (l.compareAtPriceMinor !== null && l.compareAtPriceMinor > l.unitPriceMinor
        ? (l.compareAtPriceMinor - l.unitPriceMinor) * l.quantity
        : 0),
    0,
  );

  const discountResult = discount
    ? evaluateDiscount(discount.rule, discount.code, subtotalMinor, now)
    : null;
  const discountMinor = discountResult?.applied ? discountResult.discountMinor : 0;
  const freeShipping =
    itemCount === 0 ||
    subtotalMinor >= shipping.freeShippingThresholdMinor ||
    (discountResult?.applied === true && discountResult.freeShipping);
  const shippingMinor = freeShipping ? 0 : shipping.flatFeeMinor;

  return {
    lines: quoteLines,
    itemCount,
    subtotalMinor,
    savingsMinor,
    discountMinor,
    shippingMinor,
    totalMinor: subtotalMinor - discountMinor + shippingMinor,
    currency: 'PKR',
    discount: discountResult,
    freeShippingThresholdMinor: shipping.freeShippingThresholdMinor,
    freeShippingRemainingMinor: Math.max(0, shipping.freeShippingThresholdMinor - subtotalMinor),
    purchasable: quoteLines.length > 0 && quoteLines.every((l) => l.problem === null),
  };
}

/** Compile-time guarantee that quotes match the shared contract the storefront reads. */
export const quoteMatchesContract = (quote: Quote): QuoteDto => quote;
