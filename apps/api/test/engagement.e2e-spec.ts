import { randomInt, randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { ipHashOf } from '../src/common/crypto.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ContentService } from '../src/modules/content/content.service.js';
import { NewsletterService } from '../src/modules/newsletter/newsletter.service.js';
import { generateOrderNumber } from '../src/modules/orders/order-number.js';
import { ReviewsService } from '../src/modules/reviews/reviews.service.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Reviews, newsletter, contact and content against the migrated + seeded database and Redis.
 * Each test gets its own client IP from the 198.51.100.0/24 documentation range (sent through
 * the trusted loopback proxy), so per-IP limits never leak between tests; test rows are found
 * by those IPs' hashes, the +92 399 phone range, `E2E` names and @e2e.example.test emails.
 */
const TEST_PHONE_PREFIX = '+92399';
const EMAIL_DOMAIN = '@e2e.example.test';
const TEST_PAGE = 'e2e-page';
let ipCounter = 0;
const nextIp = () => `198.51.100.${String((ipCounter += 1))}`;
const newPhone = () => `${TEST_PHONE_PREFIX}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;

interface ReviewBody {
  id: string;
  rating: number;
  createdAt: string;
  helpfulCount: number;
  verifiedPurchase: boolean;
  [key: string]: unknown;
}

describe('reviews, newsletter, contact & content (e2e)', () => {
  let app: NestNodeApplication;
  let env: Env;
  let prisma: PrismaService;
  let product: { id: string; slug: string; ratingCount: number };
  const usedIps: string[] = [];

  const api = (path: string) => `/api/v1${path}`;
  /** Requests from a fresh client IP. */
  const client = () => {
    const ip = nextIp();
    usedIps.push(ip);
    const agent = request(app.getHttpServer());
    return {
      ip,
      get: (path: string) => agent.get(api(path)).set('X-Forwarded-For', ip),
      post: (path: string) => agent.post(api(path)).set('X-Forwarded-For', ip),
    };
  };
  const review = (overrides: Record<string, unknown> = {}) => ({
    rating: 4,
    title: 'E2E lovely fabric',
    body: 'E2E review: the stitching and colours are just like the photos.',
    author: 'E2E Shopper',
    city: 'Lahore',
    ...overrides,
  });

  async function login(phone = newPhone()): Promise<{ token: string; customerId: string }> {
    const agent = request(app.getHttpServer());
    const sent = await agent.post(api('/auth/otp')).send({ phone }).expect(202);
    const res = await agent
      .post(api('/auth/otp/verify'))
      .send({ phone, code: (sent.body as { devCode: string }).devCode })
      .expect(200);
    const body = res.body as { token: string; customer: { id: string } };
    return { token: body.token, customerId: body.customer.id };
  }

  async function cleanup() {
    const hashes = usedIps.map((ip) => ipHashOf(env.AUTH_SECRET, ip) ?? '');
    await prisma.review.deleteMany({
      where: { OR: [{ ipHash: { in: hashes } }, { authorName: { startsWith: 'E2E' } }] },
    });
    await prisma.contactMessage.deleteMany({
      where: { OR: [{ ipHash: { in: hashes } }, { name: { startsWith: 'E2E' } }] },
    });
    await prisma.newsletterSubscriber.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.order.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.customer.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.otpChallenge.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.page.deleteMany({ where: { slug: TEST_PAGE } });
    await app.get(ReviewsService).invalidate();
    await app.get(ContentService).invalidate();
  }

  beforeAll(async () => {
    ({ app, env } = await createTestApp({
      RATE_LIMIT_MAX: '1000',
      AUTH_RATE_LIMIT_MAX: '1000',
      OTP_DEV_ECHO: 'true',
    }));
    prisma = app.get(PrismaService);
    product = await prisma.product.findFirstOrThrow({
      where: { status: 'ACTIVE', publishedAt: { lte: new Date() }, ratingCount: { gte: 2 } },
      orderBy: { ratingCount: 'desc' },
      select: { id: true, slug: true, ratingCount: true },
    });
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // ─── Reviews ───

  describe('reviews', () => {
    it('lists approved reviews without private fields, sorted and paginated', async () => {
      const res = await client()
        .get(`/catalog/products/${product.slug}/reviews?sort=highest&pageSize=2`)
        .expect(200);
      const body = res.body as { items: ReviewBody[]; total: number; pageCount: number };
      expect(body.total).toBe(product.ratingCount);
      expect(body.items).toHaveLength(2);
      expect(body.items[0]?.rating).toBeGreaterThanOrEqual(body.items[1]?.rating ?? 0);
      for (const item of body.items) {
        expect(Object.keys(item).sort()).toEqual(
          [
            'author',
            'body',
            'city',
            'createdAt',
            'helpfulCount',
            'id',
            'productId',
            'rating',
            'title',
            'verifiedPurchase',
          ].sort(),
        );
      }
      expect(res.headers['cache-control']).toContain('public');
    });

    it('summarises ratings per star, matching the product aggregate', async () => {
      const res = await client()
        .get(`/catalog/products/${product.slug}/reviews/summary`)
        .expect(200);
      const summary = res.body as { count: number; average: number; distribution: number[] };
      expect(summary.count).toBe(product.ratingCount);
      expect(summary.distribution.reduce((a, b) => a + b, 0)).toBe(product.ratingCount);
      expect(summary.average).toBeGreaterThan(0);
    });

    it('404s for unknown products and rejects bad queries', async () => {
      await client().get('/catalog/products/no-such-product/reviews').expect(404);
      await client().get(`/catalog/products/${product.slug}/reviews?sort=random`).expect(422);
      await client().get(`/catalog/products/${product.slug}/reviews?pageSize=500`).expect(422);
    });

    it('serves featured testimonials: five-star, verified, one per product', async () => {
      const res = await client().get('/catalog/reviews/featured?limit=4').expect(200);
      const items = res.body as (ReviewBody & { product: { slug: string } })[];
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(4);
      expect(items.every((r) => r.rating === 5 && r.verifiedPurchase)).toBe(true);
      expect(new Set(items.map((r) => r.product.slug)).size).toBe(items.length);
    });

    it('queues guest submissions for moderation (not public until approved)', async () => {
      const c = client();
      const res = await c
        .post(`/catalog/products/${product.slug}/reviews`)
        .send(review())
        .expect(202);
      const { id, status } = res.body as { id: string; status: string };
      expect(status).toBe('PENDING');

      const row = await prisma.review.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: 'PENDING',
        isVerifiedPurchase: false,
        customerId: null,
        ipHash: ipHashOf(env.AUTH_SECRET, c.ip),
      });
      const list = await client().get(`/catalog/products/${product.slug}/reviews?pageSize=20`);
      expect((list.body as { items: ReviewBody[] }).items.some((r) => r.id === id)).toBe(false);
    });

    it('updates the product rating when a review is approved (database trigger)', async () => {
      const res = await client()
        .post(`/catalog/products/${product.slug}/reviews`)
        .send(review({ rating: 1 }))
        .expect(202);
      const { id } = res.body as { id: string };
      const before = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

      await prisma.review.update({ where: { id }, data: { status: 'APPROVED' } });
      const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(after.ratingCount).toBe(before.ratingCount + 1);
      expect(after.ratingSum).toBe(before.ratingSum + 1);

      await prisma.review.delete({ where: { id } });
      const restored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(restored.ratingCount).toBe(before.ratingCount);
    });

    it('rejects invalid reviews and mass-assignment attempts', async () => {
      const c = client();
      const path = `/catalog/products/${product.slug}/reviews`;
      await c
        .post(path)
        .send(review({ rating: 6 }))
        .expect(422);
      await c
        .post(path)
        .send(review({ status: 'APPROVED' }))
        .expect(422);
      await c
        .post(path)
        .send(review({ isVerifiedPurchase: true }))
        .expect(422);
      await c
        .post(path)
        .send(review({ body: '   short​​​​   ' }))
        .expect(422);
      await c.post('/catalog/products/no-such-product/reviews').send(review()).expect(404);
    });

    it('limits submissions per IP per day', async () => {
      const c = client();
      const path = `/catalog/products/${product.slug}/reviews`;
      for (let i = 0; i < 5; i += 1) await c.post(path).send(review()).expect(202);
      const res = await c.post(path).send(review()).expect(429);
      expect(res.body).toMatchObject({ code: 'REVIEW_RATE_LIMITED' });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('marks verified purchases and allows one live review per customer', async () => {
      const phone = newPhone();
      const { token, customerId } = await login(phone);
      const variant = await prisma.productVariant.findFirstOrThrow({
        where: { productId: product.id },
        select: { id: true, sku: true },
      });
      await prisma.order.create({
        data: {
          number: generateOrderNumber(),
          accessKeyHash: 'a'.repeat(64),
          requestHash: 'b'.repeat(64),
          customerId,
          status: 'DELIVERED',
          paymentMethod: 'COD',
          customerName: 'E2E Buyer',
          phone,
          shippingName: 'E2E Buyer',
          shippingPhone: phone,
          shippingLine1: 'House 1, Street 2',
          shippingCity: 'Lahore',
          subtotalMinor: 100_000,
          shippingMinor: 0,
          totalMinor: 100_000,
          idempotencyKey: randomUUID(),
          items: {
            create: {
              productId: product.id,
              variantId: variant.id,
              productName: 'E2E',
              sku: variant.sku,
              unitPriceMinor: 100_000,
              quantity: 1,
              lineTotalMinor: 100_000,
            },
          },
        },
      });

      const c = client();
      const path = `/catalog/products/${product.slug}/reviews`;
      const res = await c
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(review({ rating: 5 }))
        .expect(202);
      const row = await prisma.review.findUniqueOrThrow({
        where: { id: (res.body as { id: string }).id },
      });
      expect(row).toMatchObject({ customerId, isVerifiedPurchase: true });
      expect(row.orderItemId).not.toBeNull();

      const again = await c
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(review())
        .expect(409);
      expect(again.body).toMatchObject({ code: 'ALREADY_REVIEWED' });
    });

    it('counts a helpful vote once per voter', async () => {
      const target = await prisma.review.findFirstOrThrow({
        where: { productId: product.id, status: 'APPROVED' },
        select: { id: true, helpfulCount: true },
      });
      const voter = client();
      try {
        const first = await voter.post(`/catalog/reviews/${target.id}/helpful`).expect(200);
        expect(first.body).toEqual({ helpfulCount: target.helpfulCount + 1 });
        const second = await voter.post(`/catalog/reviews/${target.id}/helpful`).expect(200);
        expect(second.body).toEqual({ helpfulCount: target.helpfulCount + 1 });

        const pending = await prisma.review.findFirst({ where: { status: 'PENDING' } });
        if (pending) await voter.post(`/catalog/reviews/${pending.id}/helpful`).expect(404);
        await voter.post('/catalog/reviews/not-a-uuid/helpful').expect(422);
      } finally {
        await prisma.reviewVote.deleteMany({
          where: { reviewId: target.id, voterKey: { startsWith: 'i:' } },
        });
        await prisma.review.update({
          where: { id: target.id },
          data: { helpfulCount: target.helpfulCount },
        });
      }
    });
  });

  // ─── Newsletter ───

  describe('newsletter', () => {
    it('subscribes, reports repeat sign-ups and ignores case', async () => {
      const email = `ayesha.${randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
      const c = client();
      const first = await c.post('/newsletter/subscriptions').send({ email, source: 'footer' });
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ alreadySubscribed: false });

      const again = await c.post('/newsletter/subscriptions').send({ email: email.toUpperCase() });
      expect(again.body).toEqual({ alreadySubscribed: true });

      const row = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
      expect(row).toMatchObject({ status: 'SUBSCRIBED', source: 'footer' });
    });

    it('unsubscribes only with the signed token, and re-subscribing is fresh consent', async () => {
      const email = `sana.${randomUUID().slice(0, 8)}${EMAIL_DOMAIN}`;
      const c = client();
      await c.post('/newsletter/subscriptions').send({ email }).expect(200);

      const bad = await c
        .post('/newsletter/unsubscribe')
        .send({ email, token: '0'.repeat(32) })
        .expect(400);
      expect(bad.body).toMatchObject({ code: 'INVALID_UNSUBSCRIBE_LINK' });

      const token = app.get(NewsletterService).unsubscribeToken(email);
      await c.post('/newsletter/unsubscribe').send({ email, token }).expect(204);
      await c.post('/newsletter/unsubscribe').send({ email, token }).expect(204); // idempotent
      const unsubscribed = await prisma.newsletterSubscriber.findUniqueOrThrow({
        where: { email },
      });
      expect(unsubscribed.status).toBe('UNSUBSCRIBED');

      const back = await c.post('/newsletter/subscriptions').send({ email }).expect(200);
      expect(back.body).toEqual({ alreadySubscribed: false });
      const row = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
      expect(row.status).toBe('SUBSCRIBED');
      expect(row.unsubscribedAt).toBeNull();
      expect(row.consentAt.getTime()).toBeGreaterThan(unsubscribed.consentAt.getTime());
    });

    it('validates the address', async () => {
      await client().post('/newsletter/subscriptions').send({ email: 'not-an-email' }).expect(422);
      await client()
        .post('/newsletter/subscriptions')
        .send({ email: `x${EMAIL_DOMAIN}`, source: 'hacker' })
        .expect(422);
    });
  });

  // ─── Contact ───

  describe('contact', () => {
    const message = (overrides: Record<string, unknown> = {}) => ({
      name: 'E2E Ayesha',
      phone: '0300 1234567',
      email: '',
      topic: 'ORDER',
      orderNumber: 'as-261120-ab2cd',
      message: 'E2E: when will my order arrive?',
      ...overrides,
    });

    it('stores a normalised message with a hashed IP', async () => {
      const c = client();
      const res = await c.post('/contact').send(message()).expect(202);
      expect(res.body).toEqual({ received: true });
      const row = await prisma.contactMessage.findFirstOrThrow({
        where: { ipHash: ipHashOf(env.AUTH_SECRET, c.ip) },
      });
      expect(row).toMatchObject({
        name: 'E2E Ayesha',
        phone: '+923001234567',
        email: null,
        topic: 'ORDER',
        orderNumber: 'AS-261120-AB2CD',
        status: 'NEW',
      });
    });

    it('needs a way to reply and a valid topic', async () => {
      const res = await client()
        .post('/contact')
        .send(message({ phone: '', email: '' }))
        .expect(422);
      expect(JSON.stringify(res.body)).toContain('phone');
      await client()
        .post('/contact')
        .send(message({ topic: 'Order enquiry' }))
        .expect(422);
    });

    it('limits messages per IP per hour', async () => {
      const c = client();
      for (let i = 0; i < 5; i += 1) await c.post('/contact').send(message()).expect(202);
      const res = await c.post('/contact').send(message()).expect(429);
      expect(res.body).toMatchObject({ code: 'CONTACT_RATE_LIMITED' });
    });
  });

  // ─── Content ───

  describe('content', () => {
    it('serves the published home page with validated sections in order', async () => {
      const res = await client().get('/content/pages/home').expect(200);
      const page = res.body as { slug: string; sections: { type: string; settings: unknown }[] };
      expect(page.slug).toBe('home');
      const types = page.sections.map((s) => s.type);
      expect(types[0]).toBe('hero');
      expect(types).toEqual(expect.arrayContaining(['product-carousel', 'testimonials']));
    });

    it('applies schedules and visibility, and skips invalid sections', async () => {
      const hour = 3_600_000;
      await prisma.page.create({
        data: {
          slug: TEST_PAGE,
          title: 'E2E',
          status: 'PUBLISHED',
          sections: {
            create: [
              { type: 'recently-viewed', settings: { minItems: 2 }, position: 0 },
              {
                type: 'recently-viewed',
                settings: { minItems: 3 },
                position: 1,
                startsAt: new Date(Date.now() + hour),
              },
              {
                type: 'recently-viewed',
                settings: { minItems: 4 },
                position: 2,
                endsAt: new Date(Date.now() - hour),
              },
              { type: 'recently-viewed', settings: { minItems: 5 }, position: 3, isVisible: false },
              { type: 'recently-viewed', settings: { minItems: 'lots' }, position: 4 },
              { type: 'marquee-from-the-future', settings: {}, position: 5 },
              {
                type: 'brand-story',
                settings: {
                  title: 'x',
                  script: 'x',
                  image: { src: '/a.jpg', alt: '' },
                  cta: { label: 'x', href: 'javascript:alert(1)' },
                },
                position: 6,
              },
            ],
          },
        },
      });
      await app.get(ContentService).invalidate();
      const res = await client().get(`/content/pages/${TEST_PAGE}`).expect(200);
      expect((res.body as { sections: { settings: unknown }[] }).sections).toEqual([
        expect.objectContaining({ type: 'recently-viewed', settings: { minItems: 2 } }),
      ]);

      await prisma.page.update({ where: { slug: TEST_PAGE }, data: { status: 'DRAFT' } });
      await app.get(ContentService).invalidate();
      await client().get(`/content/pages/${TEST_PAGE}`).expect(404);
    });

    it('serves menu trees', async () => {
      const res = await client().get('/content/menus/shop-mega').expect(200);
      const menu = res.body as {
        items: { label: string; children: unknown[]; settings: unknown }[];
      };
      expect(menu.items.length).toBeGreaterThan(1);
      expect(menu.items[0]?.children.length).toBeGreaterThan(0);
      await client().get('/content/menus/nope').expect(404);
    });

    it('serves only whitelisted settings and fields', async () => {
      await prisma.setting.upsert({
        where: { key: 'e2e.private' },
        update: {},
        create: { key: 'e2e.private', value: { secret: true } },
      });
      try {
        const res = await client().get('/content/settings').expect(200);
        const settings = res.body as Record<string, unknown>;
        expect(Object.keys(settings)).toEqual(
          expect.arrayContaining(['store.profile', 'store.contact', 'shipping', 'announcements']),
        );
        expect(settings).not.toHaveProperty('e2e.private');
        expect(Object.keys(settings.shipping as object).sort()).toEqual([
          'flatFeeMinor',
          'freeShippingThresholdMinor',
          'returnWindowDays',
        ]);
        await client().get('/content/settings/e2e.private').expect(404);
        await client().get('/content/settings/shipping').expect(200);
      } finally {
        await prisma.setting.delete({ where: { key: 'e2e.private' } });
      }
    });

    it('returns the live promotion', async () => {
      const res = await client().get('/content/promotions/active').expect(200);
      const { promotion } = res.body as { promotion: { id: string; endsAt: string } | null };
      if (promotion) expect(new Date(promotion.endsAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
