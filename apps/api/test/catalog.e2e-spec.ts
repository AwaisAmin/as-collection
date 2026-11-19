import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { CatalogService } from '../src/modules/catalog/catalog.service.js';
import { createTestApp } from './helpers/create-test-app.js';

interface Summary {
  slug: string;
  priceMinor: number;
  inStock: boolean;
  badges: string[];
  rating: { average: number; count: number };
  category: { slug: string };
}

/** Runs against the migrated + seeded database (`pnpm db:deploy && pnpm db:seed`). */
describe('catalog API (e2e)', () => {
  let app: NestNodeApplication;
  const get = (path: string) => request(app.getHttpServer()).get(`/api/v1/catalog${path}`);
  const slugs = (body: { items: Summary[] }) => body.items.map((p) => p.slug);

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000' }));
    await app.get(CatalogService).invalidate(); // start from a cold cache
  });

  afterAll(async () => {
    await app.close();
  });

  describe('categories & collections', () => {
    it('returns the category tree with images', async () => {
      const res = await get('/categories').expect(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.body.map((c: { slug: string }) => c.slug)).toEqual([
        'unstitched',
        'stitched',
        'makeup',
      ]);
      expect(res.body[0].image.url).toMatch(/^http.+\.jpg$/);
    });

    it('returns category page data with banner and filters', async () => {
      const res = await get('/categories/stitched').expect(200);
      expect(res.body).toMatchObject({ slug: 'stitched', banner: { eyebrow: 'Ready to wear' } });
      expect(res.body.filters.map((f: { code: string }) => f.code)).toEqual(
        expect.arrayContaining(['size', 'fabric', 'color', 'style']),
      );
    });

    it('404s unknown categories and 422s malformed slugs', async () => {
      const missing = await get('/categories/shoes').expect(404);
      expect(missing.body.code).toBe('NOT_FOUND');
      await get('/categories/Not%20A%20Slug').expect(422);
    });

    it('lists live collections (occasions + automated sale)', async () => {
      const res = await get('/collections').expect(200);
      expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(
        expect.arrayContaining(['everyday', 'dawat', 'wedding', 'eid', 'festive-sale']),
      );
    });
  });

  describe('product listing', () => {
    it('paginates with stable totals', async () => {
      const page1 = await get('/products?pageSize=5').expect(200);
      const page2 = await get('/products?pageSize=5&page=2').expect(200);
      expect(page1.body).toMatchObject({ total: 16, page: 1, pageSize: 5, pageCount: 4 });
      expect(page1.body.items).toHaveLength(5);
      const overlap = slugs(page1.body).filter((s) => slugs(page2.body).includes(s));
      expect(overlap).toEqual([]);
    });

    it('filters by category, including only that subtree', async () => {
      const res = await get('/products?category=makeup&pageSize=48').expect(200);
      expect(res.body.total).toBe(5);
      expect(res.body.items.every((p: Summary) => p.category.slug === 'makeup')).toBe(true);
    });

    it('sorts by price both ways', async () => {
      const asc = (await get('/products?sort=price-asc&pageSize=48')).body.items as Summary[];
      const desc = (await get('/products?sort=price-desc&pageSize=48')).body.items as Summary[];
      const prices = asc.map((p) => p.priceMinor);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(desc.map((p) => p.priceMinor)).toEqual([...prices].reverse());
    });

    it('sorts by rating', async () => {
      const items = (await get('/products?sort=rating&pageSize=48')).body.items as Summary[];
      const ratings = items.map((p) => p.rating.average);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    });

    it('filters by product attributes (f.fabric) and variant options in stock (f.size)', async () => {
      const lawn = await get('/products?f.fabric=lawn&pageSize=48').expect(200);
      expect(lawn.body.total).toBe(4);
      const multi = await get('/products?f.fabric=lawn,chiffon&pageSize=48').expect(200);
      expect(multi.body.total).toBe(7);
      // Maroon Ruby Kurta has no XL stock, so it must not match size XL.
      const xl = await get('/products?f.size=xl&pageSize=48').expect(200);
      expect(slugs(xl.body)).not.toContain('maroon-ruby-embroidered-kurta');
      const m = await get('/products?f.size=m&pageSize=48').expect(200);
      expect(slugs(m.body)).toContain('maroon-ruby-embroidered-kurta');
    });

    it('filters by stock, sale and price range (minor units)', async () => {
      const inStock = (await get('/products?inStock=1&pageSize=48')).body.items as Summary[];
      expect(inStock.every((p) => p.inStock)).toBe(true);
      expect(inStock.map((p) => p.slug)).not.toContain('gulnar-jacquard-unstitched-3-piece');

      const sale = (await get('/products?sale=1&pageSize=48')).body.items as Summary[];
      expect(sale.length).toBeGreaterThan(0);

      const range = (await get('/products?min=200000&max=600000&pageSize=48')).body
        .items as Summary[];
      expect(range.every((p) => p.priceMinor >= 200_000 && p.priceMinor <= 600_000)).toBe(true);
    });

    it('filters by manual and automated collections', async () => {
      const wedding = await get('/products?collection=wedding&pageSize=48').expect(200);
      expect(wedding.body.total).toBeGreaterThan(0);
      expect(slugs(wedding.body)).not.toContain('amber-lawn-straight-shirt');
      const sale = await get('/products?collection=festive-sale&pageSize=48').expect(200);
      const onSale = await get('/products?sale=1&pageSize=48').expect(200);
      expect(sale.body.total).toBe(onSale.body.total);
      await get('/products?collection=no-such-collection').expect(404);
    });

    it('searches every word across name, tags and category, case-insensitively', async () => {
      const res = await get('/products?q=BLACK%20chiffon&pageSize=48').expect(200);
      expect(slugs(res.body)).toContain('siyah-chiffon-gold-zari-suit');
      const none = await get('/products?q=zzz-no-match').expect(200);
      expect(none.body).toMatchObject({ total: 0, items: [] });
    });

    it('marks sold-out products and their badges', async () => {
      const items = (await get('/products?category=unstitched&pageSize=48')).body
        .items as Summary[];
      const gulnar = items.find((p) => p.slug === 'gulnar-jacquard-unstitched-3-piece');
      expect(gulnar).toMatchObject({ inStock: false, badges: ['sold-out'] });
    });

    it('rejects invalid queries with field errors', async () => {
      const res = await get('/products?sort=cheapest&pageSize=500').expect(422);
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(
        expect.arrayContaining(['sort', 'pageSize']),
      );
    });

    it('ignores unknown query parameters', async () => {
      await get('/products?utm_source=instagram&fbclid=abc').expect(200);
    });
  });

  describe('facets', () => {
    it('counts filter values for a category', async () => {
      const res = await get('/facets?category=stitched').expect(200);
      expect(res.body.total).toBe(5);
      expect(res.body.priceRange.minMinor).toBeLessThanOrEqual(res.body.priceRange.maxMinor);
      const size = res.body.attributes.find((a: { code: string }) => a.code === 'size');
      expect(size.scope).toBe('VARIANT');
      expect(size.values.map((v: { value: string }) => v.value)).toEqual([
        'xs',
        's',
        'm',
        'l',
        'xl',
      ]);
      // Category filters only: no makeup shades on the stitched page.
      expect(res.body.attributes.map((a: { code: string }) => a.code)).not.toContain('shade');
    });

    it('includes swatches and collection counts', async () => {
      const res = await get('/facets?category=makeup').expect(200);
      const shade = res.body.attributes.find((a: { code: string }) => a.code === 'shade');
      expect(shade.values[0].swatch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(res.body.collections.length).toBeGreaterThan(0);
    });
  });

  describe('product page', () => {
    it('returns gallery, options, variants, specs and breadcrumbs', async () => {
      const res = await get('/products/maroon-ruby-embroidered-kurta').expect(200);
      const p = res.body;
      expect(p.images.length).toBeGreaterThan(1);
      expect(p.options).toEqual([
        expect.objectContaining({
          code: 'size',
          values: expect.arrayContaining([expect.objectContaining({ value: 'm' })]),
        }),
      ]);
      expect(p.variants.length).toBe(5);
      const xl = p.variants.find((v: { options: { size: string } }) => v.options.size === 'xl');
      expect(xl.availableQuantity).toBe(0);
      expect(p.specifications[0]).toHaveProperty('label');
      expect(p.breadcrumbs).toEqual([{ slug: 'stitched', name: 'Stitched Dresses' }]);
      expect(p.attributes.map((a: { code: string }) => a.code)).toContain('fabric');
    });

    it('never exposes exact stock above the cap', async () => {
      const res = await get('/products/velvet-matte-lipstick').expect(200);
      for (const v of res.body.variants as { availableQuantity: number }[]) {
        expect(v.availableQuantity).toBeLessThanOrEqual(10);
      }
    });

    it('404s unknown products', async () => {
      await get('/products/does-not-exist').expect(404);
    });

    it('returns related products from the same category, excluding itself', async () => {
      const res = await get('/products/maroon-ruby-embroidered-kurta/related?limit=3').expect(200);
      expect(res.body).toHaveLength(3);
      expect(res.body.every((p: Summary) => p.category.slug === 'stitched')).toBe(true);
      expect(slugs({ items: res.body })).not.toContain('maroon-ruby-embroidered-kurta');
    });
  });

  describe('variant lookup (cart validation)', () => {
    it('returns fresh price and availability, never cached', async () => {
      const product = (await get('/products/velvet-matte-lipstick')).body;
      const ids = product.variants.map((v: { id: string }) => v.id).join(',');
      const res = await get(`/variants?ids=${ids}`).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toHaveLength(product.variants.length);
      expect(res.body[0]).toMatchObject({
        productSlug: 'velvet-matte-lipstick',
        purchasable: true,
      });
    });

    it('validates ids', async () => {
      await get('/variants?ids=not-a-uuid').expect(422);
      await get('/variants').expect(422);
    });
  });

  describe('caching', () => {
    it('serves cached listings until the catalog is invalidated', async () => {
      const prisma = app.get(PrismaService);
      const catalog = app.get(CatalogService);
      const slug = 'amber-lawn-straight-shirt';
      // Every variant (all sizes) must be out of stock for the product to be sold out.
      const inventory = await prisma.inventoryItem.findMany({
        where: { variant: { product: { slug } } },
        select: { variantId: true, onHand: true },
      });
      expect(inventory.length).toBeGreaterThan(0);
      const isListedInStock = async () =>
        ((await get('/products?inStock=1&pageSize=48')).body.items as Summary[]).some(
          (p) => p.slug === slug,
        );

      expect(await isListedInStock()).toBe(true); // primes the cache
      await prisma.inventoryItem.updateMany({
        where: { variantId: { in: inventory.map((i) => i.variantId) } },
        data: { onHand: 0 },
      });
      try {
        expect(await isListedInStock()).toBe(true); // still the cached answer
        await catalog.invalidate();
        expect(await isListedInStock()).toBe(false); // trigger flipped in_stock; cache refreshed
      } finally {
        await prisma.$transaction(
          inventory.map((i) =>
            prisma.inventoryItem.update({
              where: { variantId: i.variantId },
              data: { onHand: i.onHand },
            }),
          ),
        );
        await catalog.invalidate();
      }
    });
  });
});
