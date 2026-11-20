import type { FacetsDto, ProductDetailDto, ProductSummaryDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import { catalogQuerySchema } from '../schemas';
import {
  optionIndex,
  toFacets,
  toImageSrc,
  toListParams,
  toProduct,
  toReview,
  toRupees,
  toSummary,
} from './api-mappers';

const SITE = 'https://shop.example';

const summary: ProductSummaryDto = {
  id: 'p1',
  slug: 'ruby-lipstick',
  name: 'Ruby Lipstick',
  category: { slug: 'makeup', name: 'Makeup' },
  image: { url: `${SITE}/images/products/ruby.jpg`, alt: 'Ruby lipstick' },
  hoverImage: null,
  priceMinor: 120_000,
  compareAtPriceMinor: 150_000,
  priceVaries: false,
  inStock: true,
  badges: ['sale'],
  rating: { average: 4.5, count: 12 },
  quickAddVariantId: null,
};

describe('api mappers', () => {
  it('converts paisa to whole rupees and own-site images to paths', () => {
    expect(toRupees(120_000)).toBe(1200);
    expect(toImageSrc(`${SITE}/media/x/full.webp`, SITE)).toBe('/media/x/full.webp');
    expect(toImageSrc('https://cdn.example/media/x.webp', SITE)).toBe(
      'https://cdn.example/media/x.webp',
    );
    expect(toSummary(summary, SITE)).toMatchObject({
      category: 'makeup',
      image: { src: '/images/products/ruby.jpg', alt: 'Ruby lipstick' },
      price: 1200,
      compareAtPrice: 1500,
    });
    expect(toSummary(summary, SITE)).not.toHaveProperty('quickAddVariantId');
  });

  it('maps variant option codes and slugs to the names and labels shoppers see', () => {
    const detail: ProductDetailDto = {
      ...summary,
      shortDescription: null,
      description: 'First paragraph.\n\nSecond paragraph.',
      images: [],
      specifications: [{ label: 'Finish', value: 'Matte' }],
      sizeGuide: null,
      attributes: [],
      options: [
        {
          code: 'shade',
          name: 'Shade',
          values: [{ value: 'ruby-red', label: 'Ruby Red', swatch: '#9b1b30' }],
        },
      ],
      variants: [
        {
          id: 'v1',
          sku: 'MKUP-001-01',
          title: 'Ruby Red',
          options: { shade: 'ruby-red' },
          priceMinor: 120_000,
          compareAtPriceMinor: null,
          availableQuantity: 4,
        },
      ],
      breadcrumbs: [{ slug: 'makeup', name: 'Makeup' }],
      collections: [
        { slug: 'eid', name: 'Eid' },
        { slug: 'festive-sale', name: 'Festive sale' },
      ],
      tags: ['lipstick'],
      seo: { title: null, description: null },
      publishedAt: '2026-11-01T00:00:00.000Z',
    };
    const product = toProduct(detail, SITE);
    expect(product.options).toEqual([
      { name: 'Shade', values: [{ value: 'Ruby Red', swatch: '#9b1b30' }] },
    ]);
    expect(product.variants[0]).toMatchObject({
      options: { Shade: 'Ruby Red' },
      price: 1200,
      stock: 4,
    });
    expect(product.description).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(product.occasions).toEqual(['eid']);
    expect(product.images).toHaveLength(1); // placeholder, never an empty gallery
  });

  it('translates storefront filters (labels, rupees, occasions) to API parameters', () => {
    const facets: FacetsDto = {
      total: 3,
      priceRange: { minMinor: 100_000, maxMinor: 900_000 },
      attributes: [
        {
          code: 'shade',
          name: 'Shade',
          scope: 'VARIANT',
          values: [{ value: 'ruby-red', label: 'Ruby Red', swatch: null, count: 2 }],
        },
        { code: 'fabric', name: 'Fabric', scope: 'PRODUCT', values: [] },
      ],
      collections: [{ slug: 'wedding', name: 'Wedding', count: 2 }],
    };
    const query = catalogQuerySchema.parse({
      category: 'makeup',
      shade: 'Ruby Red,Rose Gold',
      size: 'M',
      min: '1000',
      occasion: 'wedding',
      inStock: '1',
    });
    expect(toListParams(query, 12, optionIndex(facets))).toMatchObject({
      category: 'makeup',
      min: 100_000,
      collection: ['wedding'],
      inStock: true,
      'f.shade': ['ruby-red', 'rose-gold'],
      'f.size': ['m'],
      page: 1,
      pageSize: 12,
    });
    expect(toFacets(facets)).toEqual({
      priceRange: { min: 1000, max: 9000 },
      options: [{ name: 'Shade', values: [{ value: 'Ruby Red', count: 2 }] }],
      occasions: [{ slug: 'wedding', count: 2 }],
    });
  });

  it('keeps the store reply on reviews', () => {
    const review = toReview({
      id: 'r1',
      productId: 'p1',
      author: 'Sana',
      city: null,
      rating: 5,
      title: 'Lovely',
      body: 'Lovely shade.',
      createdAt: '2026-11-01T00:00:00.000Z',
      verifiedPurchase: true,
      helpfulCount: 2,
      reply: { body: 'Thank you!', at: '2026-11-02T00:00:00.000Z' },
    });
    expect(review.reply?.body).toBe('Thank you!');
    expect(review).not.toHaveProperty('city');
  });
});
