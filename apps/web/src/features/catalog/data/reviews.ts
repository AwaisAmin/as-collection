/**
 * MOCK REVIEWS — deterministic (seeded) so builds and tests are stable.
 */
import type { CategorySlug } from '@/config/catalog';

import type { Review } from '../types';
import { rawProducts } from './products';

/** Fixed "today" for deterministic mock dates. */
const MOCK_NOW = Date.parse('2026-11-19T00:00:00.000Z');

/** mulberry32 — tiny seeded PRNG. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const names = [
  'Ayesha K.',
  'Fatima R.',
  'Hira S.',
  'Sana M.',
  'Mehwish A.',
  'Zainab H.',
  'Maryam T.',
  'Iqra N.',
  'Rabia Z.',
  'Amna F.',
  'Noor U.',
  'Saba J.',
  'Kiran B.',
  'Hafsa Y.',
  'Areeba Q.',
  'Laiba W.',
];

const cities = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
];

type Template = Pick<Review, 'rating' | 'title' | 'body'>;

const templates: Record<CategorySlug, readonly Template[]> = {
  unstitched: [
    {
      rating: 5,
      title: 'Embroidery is stunning',
      body: 'The zari work is even more beautiful in person. Fabric quality is excellent and the dupatta is so soft. Got so many compliments at the dawat!',
    },
    {
      rating: 5,
      title: 'Exactly as pictured',
      body: 'Colours are exactly like the pictures. Packing was neat and delivery reached Lahore in 3 days. Cash on delivery made it easy.',
    },
    {
      rating: 4,
      title: 'Lovely suit, slightly sheer',
      body: 'Beautiful embroidery and good quality, but the shirt fabric is a little sheer so I added a lining. Still very happy with it.',
    },
    {
      rating: 5,
      title: 'Worth every rupee',
      body: 'Premium feel at a fair price. My tailor said the cutting length is generous. Will definitely order again.',
    },
    {
      rating: 3,
      title: 'Good but delivery was late',
      body: 'The suit itself is nice, but delivery took a week. Customer support was helpful when I called though.',
    },
    {
      rating: 5,
      title: 'Perfect for Eid',
      body: 'Wore this on Eid and everyone asked where it was from. The gold work does not look cheap at all.',
    },
    {
      rating: 4,
      title: 'Beautiful colours',
      body: 'Rich colours and neat embroidery. Trouser fabric could be a bit thicker but overall very good.',
    },
  ],
  stitched: [
    {
      rating: 5,
      title: 'Fits perfectly',
      body: 'Ordered my usual size and it fits perfectly. Stitching is neat and the inner lining is comfortable. Really elegant!',
    },
    {
      rating: 5,
      title: 'Gorgeous for weddings',
      body: 'Wore it to my cousin’s mehndi and loved it. The embroidery catches the light beautifully.',
    },
    {
      rating: 4,
      title: 'Runs slightly large',
      body: 'Lovely dress but it runs a little large — I would size down. Exchange process was simple though.',
    },
    {
      rating: 5,
      title: 'Premium quality',
      body: 'Feels like a designer piece. The sleeves are so pretty and the colour is rich in person.',
    },
    {
      rating: 2,
      title: 'Colour a bit different',
      body: 'The maroon was darker than I expected from the photos. Quality is fine but not what I imagined.',
    },
    {
      rating: 5,
      title: 'Fast delivery, great packing',
      body: 'Arrived in Karachi in 2 days, beautifully packed. The fit and finish are excellent.',
    },
  ],
  makeup: [
    {
      rating: 5,
      title: 'My new favourite',
      body: 'Long-lasting and so comfortable. The packaging is gorgeous — feels very luxurious.',
    },
    {
      rating: 5,
      title: 'Great shade range',
      body: 'Found my exact shade. Blends easily and stays all day even in Karachi heat.',
    },
    {
      rating: 4,
      title: 'Lovely but a little drying',
      body: 'Beautiful colour and payoff. Slightly drying after a few hours so I use a balm underneath.',
    },
    {
      rating: 5,
      title: 'Perfect gift',
      body: 'Bought this as a gift for my sister and she loved it. The black and gold design looks so classy.',
    },
    {
      rating: 3,
      title: 'Okay for the price',
      body: 'Works fine, nothing extraordinary. Packaging is the best part honestly.',
    },
    {
      rating: 5,
      title: 'Original and fresh',
      body: 'Product was fresh with a long expiry date. Will reorder for sure.',
    },
  ],
};

/** Products with no reviews yet (to exercise the empty state). */
const noReviews = new Set(['unst-006']);

/** Seeded Fisher–Yates shuffle of indices 0..n-1. */
function shuffle(n: number, rand: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function generate(): Review[] {
  const reviews: Review[] = [];

  rawProducts.forEach((product, productIndex) => {
    if (noReviews.has(product.id)) return;
    const rand = seeded(productIndex + 1);
    const pool = templates[product.category];
    const count = 3 + Math.floor(rand() * 7); // 3–9
    const start = Date.parse(product.createdAt);
    const span = Math.max(MOCK_NOW - start, 86_400_000);
    // Shuffle (seeded) and cycle so a product repeats a template/name only after using them all.
    const order = shuffle(pool.length, rand);
    const authorOrder = shuffle(names.length, rand);

    for (let i = 0; i < count; i++) {
      const t = pool[order[i % order.length]!]!;
      reviews.push({
        id: `${product.id}-r${i + 1}`,
        productId: product.id,
        author: names[authorOrder[i % authorOrder.length]!]!,
        city: cities[Math.floor(rand() * cities.length)],
        rating: t.rating,
        title: t.title,
        body: t.body,
        createdAt: new Date(start + rand() * span).toISOString(),
        verifiedPurchase: rand() > 0.2,
        helpfulCount: Math.floor(rand() * 24),
      });
    }
  });

  return reviews;
}

export const mockReviews: readonly Review[] = generate();
