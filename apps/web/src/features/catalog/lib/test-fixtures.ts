import type { Product, ProductVariant } from '../types';

/* Small hand-written products for unit tests (the real catalog lives in the API). */

const base = {
  shortDescription: '',
  description: [],
  images: [{ src: '/images/hero-model.jpg', alt: '' }],
  details: [],
  tags: [],
  occasions: [],
  rating: { average: 0, count: 0 },
  createdAt: '2026-11-01T00:00:00.000Z',
} as const;

const variant = (
  sku: string,
  options: Record<string, string>,
  price: number,
  stock: number,
  compareAtPrice?: number,
): ProductVariant => ({
  id: sku.toLowerCase(),
  sku,
  options,
  price,
  stock,
  ...(compareAtPrice ? { compareAtPrice } : {}),
});

/** Sizes S–XL; XL is sold out; the cheapest sizes are discounted. */
export const kurta: Product = {
  ...base,
  id: 'kurta',
  slug: 'maroon-ruby-embroidered-kurta',
  name: 'Maroon Ruby Embroidered Kurta',
  category: 'stitched',
  categoryPath: [{ slug: 'stitched', name: 'Stitched Dresses' }],
  options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL'].map((value) => ({ value })) }],
  variants: [
    variant('STCH-001-S', { Size: 'S' }, 7490, 3, 8990),
    variant('STCH-001-M', { Size: 'M' }, 7490, 5, 8990),
    variant('STCH-001-L', { Size: 'L' }, 7990, 2),
    variant('STCH-001-XL', { Size: 'XL' }, 7990, 0),
  ],
};

/** Shades; Nude Petal is sold out. */
export const lipstick: Product = {
  ...base,
  id: 'lipstick',
  slug: 'velvet-matte-lipstick',
  name: 'Velvet Matte Lipstick',
  category: 'makeup',
  categoryPath: [{ slug: 'makeup', name: 'Makeup' }],
  options: [
    {
      name: 'Shade',
      values: [
        { value: 'Ruby Red', swatch: '#9b1b30' },
        { value: 'Nude Petal', swatch: '#c08a7a' },
      ],
    },
  ],
  variants: [
    variant('MKUP-001-01', { Shade: 'Ruby Red' }, 1290, 6),
    variant('MKUP-001-02', { Shade: 'Nude Petal' }, 1290, 0),
  ],
};
