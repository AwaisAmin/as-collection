import {
  availableQuantity,
  badgesFor,
  MAX_VISIBLE_QUANTITY,
  mediaUrl,
  type ProductSummaryRow,
  toProductSummary,
} from './catalog.mapper.js';

const now = new Date('2026-11-19T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const row = (overrides: Partial<ProductSummaryRow> = {}): ProductSummaryRow => ({
  id: 'p1',
  slug: 'noor',
  name: 'Noor',
  publishedAt: daysAgo(60),
  isBestseller: false,
  priceMinMinor: 649_000,
  priceMaxMinor: 649_000,
  compareAtMinor: null,
  inStock: true,
  ratingAverage: 4.428_571,
  ratingCount: 7,
  primaryCategory: { slug: 'unstitched', name: 'Unstitched Dresses' },
  media: [
    { alt: null, media: { storageKey: 'images/a b.jpg', alt: 'Front', width: 900, height: 1200 } },
    {
      alt: 'Back view',
      media: { storageKey: 'images/b.jpg', alt: null, width: null, height: null },
    },
  ],
  variants: [{ id: 'v1' }],
  ...overrides,
});

describe('badgesFor', () => {
  it('shows only "sold-out" when nothing can be bought', () => {
    expect(badgesFor({ ...row(), inStock: false, isBestseller: true }, now)).toEqual(['sold-out']);
  });

  it('marks discounts, recent products and bestsellers', () => {
    expect(
      badgesFor(
        { ...row(), compareAtMinor: 799_000, publishedAt: daysAgo(3), isBestseller: true },
        now,
      ),
    ).toEqual(['sale', 'new', 'bestseller']);
    expect(badgesFor({ ...row(), publishedAt: daysAgo(31) }, now)).toEqual([]);
  });
});

describe('availableQuantity', () => {
  const inv = { onHand: 5, reserved: 2, trackInventory: true, allowBackorder: false };

  it('subtracts reservations and never goes negative', () => {
    expect(availableQuantity(inv)).toBe(3);
    expect(availableQuantity({ ...inv, reserved: 9 })).toBe(0);
  });

  it('caps the visible quantity so exact stock stays private', () => {
    expect(availableQuantity({ ...inv, onHand: 500 })).toBe(MAX_VISIBLE_QUANTITY);
    expect(availableQuantity({ ...inv, trackInventory: false })).toBe(MAX_VISIBLE_QUANTITY);
  });

  it('treats a missing inventory row as unavailable', () => {
    expect(availableQuantity(null)).toBe(0);
  });
});

describe('toProductSummary', () => {
  it('maps prices, rating, images and quick add', () => {
    const summary = toProductSummary(row(), 'https://cdn.test', now);
    expect(summary).toMatchObject({
      priceMinor: 649_000,
      priceVaries: false,
      rating: { average: 4.4, count: 7 },
      quickAddVariantId: 'v1',
      image: { url: 'https://cdn.test/images/a%20b.jpg', alt: 'Front' },
      hoverImage: { url: 'https://cdn.test/images/b.jpg', alt: 'Back view' },
    });
  });

  it('offers no quick add for multi-variant or sold-out products', () => {
    expect(
      toProductSummary(row({ variants: [{ id: 'a' }, { id: 'b' }] }), '', now).quickAddVariantId,
    ).toBeNull();
    expect(toProductSummary(row({ inStock: false }), '', now).quickAddVariantId).toBeNull();
  });

  it('flags "From" pricing when variants differ', () => {
    expect(toProductSummary(row({ priceMaxMinor: 700_000 }), '', now).priceVaries).toBe(true);
  });
});

describe('mediaUrl', () => {
  it('encodes each path segment', () => {
    expect(mediaUrl('https://cdn.test', 'images/products/ruby red#1.jpg')).toBe(
      'https://cdn.test/images/products/ruby%20red%231.jpg',
    );
  });
});
