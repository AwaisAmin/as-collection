import { randomInt, randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { SessionService } from '../src/modules/auth/session.service.js';
import { CatalogService } from '../src/modules/catalog/catalog.service.js';
import { MemoryObjectStorage, OBJECT_STORAGE } from '../src/storage/object-storage.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Checkout against the seeded catalog. Uses the Velvet Matte Lipstick variants (whose stock is
 * snapshotted and restored), +92 399 test phones and E2E coupons; everything is cleaned up.
 */
const TEST_PHONE_PREFIX = '+92399';
const SKU_MAIN = 'MKUP-001-01';
const SKU_LOW = 'MKUP-001-04';
const COUPON = 'E2E-ORDERS-15';
const ONE_USE_COUPON = 'E2E-ONCE';
const BIG_ORDER_COUPON = 'E2E-BIG';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const newPhone = () => `${TEST_PHONE_PREFIX}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;

interface QuoteBody {
  totalMinor: number;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  purchasable: boolean;
  discount: { applied: boolean; reason?: string } | null;
  lines: { variantId: string; problem: string | null; availableQuantity: number }[];
}

interface OrderBody {
  number: string;
  status: string;
  paymentStatus: string;
  totals: { totalMinor: number };
  actions: { canCancel: boolean; canUploadPaymentProof: boolean };
  timeline: { type: string }[];
}

describe('checkout & orders (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  let storage: MemoryObjectStorage;
  let mainId: string;
  let lowId: string;
  let stockSnapshot: { variantId: string; onHand: number; reserved: number }[];

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;

  const orderBody = (overrides: {
    phone?: string;
    quantity?: number;
    variantId?: string;
    paymentMethod?: string;
    discountCode?: string;
    expectedTotalMinor: number;
  }) => ({
    customer: { fullName: 'Ayesha Malik', phone: overrides.phone ?? newPhone(), email: '' },
    shipping: { line1: 'House 12, Street 4, DHA Phase 5', city: 'Lahore', postalCode: '54000' },
    paymentMethod: overrides.paymentMethod ?? 'COD',
    lines: [{ variantId: overrides.variantId ?? mainId, quantity: overrides.quantity ?? 1 }],
    ...(overrides.discountCode ? { discountCode: overrides.discountCode } : {}),
    expectedTotalMinor: overrides.expectedTotalMinor,
  });

  async function quote(lines: { variantId: string; quantity: number }[], discountCode?: string) {
    const res = await http()
      .post(api('/checkout/quote'))
      .send({ lines, ...(discountCode ? { discountCode } : {}) })
      .expect(200);
    return res.body as QuoteBody;
  }

  async function place(body: object, key = randomUUID(), token?: string) {
    const req = http().post(api('/orders')).set('Idempotency-Key', key);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  }

  async function placeCod(options: { phone?: string; token?: string; quantity?: number } = {}) {
    const q = await quote([{ variantId: mainId, quantity: options.quantity ?? 1 }]);
    const res = await place(
      orderBody({
        phone: options.phone,
        quantity: options.quantity,
        expectedTotalMinor: q.totalMinor,
      }),
      randomUUID(),
      options.token,
    );
    expect(res.status).toBe(201);
    return res.body as { order: OrderBody; accessKey: string };
  }

  const reservedOf = async (variantId: string) =>
    (await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } })).reserved;

  async function signedInCustomer(phone = newPhone()) {
    const customer = await prisma.customer.create({
      data: { phone, phoneVerifiedAt: new Date(), name: 'Test Customer' },
    });
    const { token } = await app
      .get(SessionService)
      .create(customer.id, { ip: '127.0.0.1', userAgent: 'e2e' });
    return { customer, token, phone };
  }

  async function cleanup() {
    await prisma.order.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.customer.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.discount.deleteMany({ where: { code: { startsWith: 'E2E-' } } });
    await prisma.media.deleteMany({ where: { storageKey: { startsWith: 'payment-proofs/' } } });
  }

  beforeAll(async () => {
    storage = new MemoryObjectStorage();
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }, (b) =>
      b.overrideProvider(OBJECT_STORAGE).useValue(storage),
    ));
    prisma = app.get(PrismaService);
    await cleanup();

    const variants = await prisma.productVariant.findMany({
      where: { sku: { in: [SKU_MAIN, SKU_LOW] } },
      select: { id: true, sku: true, inventory: true },
    });
    mainId = variants.find((v) => v.sku === SKU_MAIN)?.id ?? '';
    lowId = variants.find((v) => v.sku === SKU_LOW)?.id ?? '';
    stockSnapshot = variants.map((v) => ({
      variantId: v.id,
      onHand: v.inventory?.onHand ?? 0,
      reserved: v.inventory?.reserved ?? 0,
    }));
    await prisma.inventoryItem.updateMany({
      where: { variantId: mainId },
      data: { onHand: 50, reserved: 0 },
    });

    await prisma.discount.createMany({
      data: [
        { code: COUPON, type: 'PERCENTAGE', value: 1500, minSubtotalMinor: 100_000 },
        { code: ONE_USE_COUPON, type: 'FIXED_AMOUNT', value: 10_000, usageLimit: 1 },
        { code: BIG_ORDER_COUPON, type: 'PERCENTAGE', value: 1000, minSubtotalMinor: 1_000_000 },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    for (const s of stockSnapshot) {
      await prisma.inventoryItem.update({
        where: { variantId: s.variantId },
        data: { onHand: s.onHand, reserved: s.reserved },
      });
    }
    await app.get(CatalogService).invalidate();
    await app.close();
  });

  describe('quote', () => {
    it('prices the cart from the database with shipping and stock status', async () => {
      const q = await quote([{ variantId: mainId, quantity: 2 }]);
      expect(q).toMatchObject({ subtotalMinor: 258_000, purchasable: true });
      expect(q.totalMinor).toBe(q.subtotalMinor - q.discountMinor + q.shippingMinor);
      expect(q.lines[0]).toMatchObject({ problem: null, availableQuantity: 10 });
    });

    it('flags unknown variants and validates input', async () => {
      const q = await quote([{ variantId: randomUUID(), quantity: 1 }]);
      expect(q.purchasable).toBe(false);
      expect(q.lines[0]?.problem).toBe('UNAVAILABLE');
      await http().post(api('/checkout/quote')).send({ lines: [] }).expect(422);
      await http()
        .post(api('/checkout/quote'))
        .send({ lines: [{ variantId: mainId, quantity: 11 }] })
        .expect(422);
    });

    it('applies and explains coupons', async () => {
      const applied = await quote([{ variantId: mainId, quantity: 1 }], COUPON.toLowerCase());
      // 15 % of Rs 1,290 = Rs 193.50, rounded down to whole rupees.
      expect(applied).toMatchObject({ discountMinor: 19_300, discount: { applied: true } });
      const unknown = await quote([{ variantId: mainId, quantity: 1 }], 'E2E-NOPE');
      expect(unknown.discount).toMatchObject({ applied: false, reason: 'NOT_FOUND' });
      const tooSmall = await quote([{ variantId: mainId, quantity: 1 }], BIG_ORDER_COUPON);
      expect(tooSmall.discount).toMatchObject({
        applied: false,
        reason: 'MIN_SUBTOTAL',
        minSubtotalMinor: 1_000_000,
      });
      expect(tooSmall.discountMinor).toBe(0);
    });
  });

  describe('placing orders', () => {
    it('places a COD order, reserves stock and returns an access key', async () => {
      const before = await reservedOf(mainId);
      const q = await quote([{ variantId: mainId, quantity: 2 }]);
      const res = await place(orderBody({ quantity: 2, expectedTotalMinor: q.totalMinor }));
      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers.location).toMatch(/^\/api\/v1\/orders\/AS-\d{6}-[A-Z2-9]{5}$/);
      const { order, accessKey } = res.body as { order: OrderBody; accessKey: string };
      expect(accessKey).toMatch(/^[0-9a-f]{32}$/);
      expect(order).toMatchObject({
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        totals: { totalMinor: q.totalMinor },
        actions: { canCancel: true, canUploadPaymentProof: false },
      });
      expect(order.timeline.map((e) => e.type)).toEqual(['order.placed']);
      expect(await reservedOf(mainId)).toBe(before + 2);

      const stored = await prisma.order.findUniqueOrThrow({ where: { number: order.number } });
      expect(stored.accessKeyHash).not.toContain(accessKey);
    });

    it('is idempotent: a retry returns the same order, a different body is rejected', async () => {
      const q = await quote([{ variantId: mainId, quantity: 1 }]);
      const body = orderBody({ expectedTotalMinor: q.totalMinor });
      const key = randomUUID();
      const first = await place(body, key);
      const retry = await place(body, key);
      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(retry.body.order.number).toBe(first.body.order.number);
      expect(retry.body.accessKey).toBe(first.body.accessKey);

      const reused = await place({ ...body, notes: 'changed' }, key);
      expect(reused.status).toBe(422);
      expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const noKey = await http().post(api('/orders')).send(body);
      expect(noKey.status).toBe(422);
      expect(noKey.body.errors[0].path).toBe('Idempotency-Key');
    });

    it('refuses when the total changed, returning a fresh quote', async () => {
      const res = await place(orderBody({ expectedTotalMinor: 1 }));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PRICE_CHANGED');
      expect(res.body.quote.totalMinor).toBeGreaterThan(1);
    });

    it('never oversells: parallel checkouts for the last unit place exactly one order', async () => {
      await prisma.inventoryItem.update({
        where: { variantId: lowId },
        data: { onHand: 1, reserved: 0 },
      });
      const q = await quote([{ variantId: lowId, quantity: 1 }]);
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          place(orderBody({ variantId: lowId, expectedTotalMinor: q.totalMinor })),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409, 409]);
      const conflict = results.find((r) => r.status === 409);
      expect(conflict?.body.code).toBe('OUT_OF_STOCK');
      expect(conflict?.body.quote.lines[0].problem).toBe('UNAVAILABLE');
      expect(await reservedOf(lowId)).toBe(1);
    });

    it('rejects quantities above the available stock', async () => {
      await prisma.inventoryItem.update({
        where: { variantId: lowId },
        data: { onHand: 3, reserved: 0 },
      });
      const res = await place(orderBody({ variantId: lowId, quantity: 5, expectedTotalMinor: 0 }));
      expect(res.status).toBe(409);
      expect(res.body.quote.lines[0]).toMatchObject({
        problem: 'INSUFFICIENT_STOCK',
        availableQuantity: 3,
      });
    });

    it('applies coupons and enforces their usage limit', async () => {
      const q = await quote([{ variantId: mainId, quantity: 1 }], ONE_USE_COUPON);
      expect(q.discountMinor).toBe(10_000);
      const first = await place(
        orderBody({ discountCode: ONE_USE_COUPON, expectedTotalMinor: q.totalMinor }),
      );
      expect(first.status).toBe(201);
      const second = await place(
        orderBody({ discountCode: ONE_USE_COUPON, expectedTotalMinor: q.totalMinor }),
      );
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('DISCOUNT_INVALID');
    });
  });

  describe('access, tracking and cancellation', () => {
    it('shows the order only with its access key', async () => {
      const { order, accessKey } = await placeCod();
      const ok = await http()
        .get(api(`/orders/${order.number}`))
        .set('X-Order-Access-Key', accessKey)
        .expect(200);
      expect(ok.body.customer.fullName).toBe('Ayesha Malik');
      // Lowercase / spaced numbers are accepted.
      await http()
        .get(api(`/orders/${order.number.toLowerCase()}`))
        .set('X-Order-Access-Key', accessKey)
        .expect(200);

      const wrong = await http()
        .get(api(`/orders/${order.number}`))
        .set('X-Order-Access-Key', '0'.repeat(32));
      expect(wrong.status).toBe(404);
      expect(wrong.body.code).toBe('ORDER_NOT_FOUND');
      await http()
        .get(api(`/orders/${order.number}`))
        .expect(404);
      await http().get(api('/orders/AS-000000-AAAAA')).expect(404);
    });

    it('tracks by number + phone without personal details', async () => {
      const phone = newPhone();
      const { order } = await placeCod({ phone });
      const res = await http()
        .post(api('/orders/track'))
        .send({ number: order.number, phone: `0${phone.slice(3)}` })
        .expect(200);
      expect(res.body).toMatchObject({ number: order.number, status: 'PENDING', city: 'Lahore' });
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('Ayesha');
      expect(json).not.toContain('DHA Phase');
      expect(json).not.toContain(phone);

      await http()
        .post(api('/orders/track'))
        .send({ number: order.number, phone: newPhone() })
        .expect(404);
    });

    it('lets the customer cancel a pending order once, releasing the stock', async () => {
      const { order, accessKey } = await placeCod({ quantity: 3 });
      const before = await reservedOf(mainId);
      const res = await http()
        .post(api(`/orders/${order.number}/cancel`))
        .set('X-Order-Access-Key', accessKey)
        .expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', actions: { canCancel: false } });
      expect(await reservedOf(mainId)).toBe(before - 3);

      const again = await http()
        .post(api(`/orders/${order.number}/cancel`))
        .set('X-Order-Access-Key', accessKey)
        .expect(409);
      expect(again.body.code).toBe('ORDER_NOT_CANCELLABLE');
    });
  });

  describe('payment proofs', () => {
    async function placeTransfer() {
      const q = await quote([{ variantId: mainId, quantity: 1 }]);
      const res = await place(
        orderBody({ paymentMethod: 'JAZZCASH', expectedTotalMinor: q.totalMinor }),
      );
      expect(res.status).toBe(201);
      return res.body as { order: OrderBody; accessKey: string };
    }

    it('stores a screenshot privately and marks the payment for verification', async () => {
      const { order, accessKey } = await placeTransfer();
      expect(order.actions.canUploadPaymentProof).toBe(true);

      const res = await http()
        .post(api(`/orders/${order.number}/payment-proof`))
        .set('X-Order-Access-Key', accessKey)
        .field('reference', 'TID 123456789')
        .attach('file', PNG, { filename: 'proof.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body).toMatchObject({
        paymentStatus: 'AWAITING_VERIFICATION',
        paymentProofs: [{ status: 'PENDING', reference: 'TID 123456789', method: 'JAZZCASH' }],
        actions: { canCancel: false },
      });

      const media = await prisma.media.findFirstOrThrow({
        where: { storageKey: { startsWith: 'payment-proofs/' }, paymentProofs: { some: {} } },
        orderBy: { createdAt: 'desc' },
      });
      expect(media).toMatchObject({ visibility: 'PRIVATE', mimeType: 'image/png' });
      expect(storage.objects.get(media.storageKey)?.body.equals(PNG)).toBe(true);
    });

    it('rejects files that are not images, whatever they are called', async () => {
      const { order, accessKey } = await placeTransfer();
      const res = await http()
        .post(api(`/orders/${order.number}/payment-proof`))
        .set('X-Order-Access-Key', accessKey)
        .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
          filename: 'proof.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');

      const missing = await http()
        .post(api(`/orders/${order.number}/payment-proof`))
        .set('X-Order-Access-Key', accessKey)
        .field('reference', 'x');
      expect(missing.body.code).toBe('FILE_REQUIRED');
    });

    it('refuses proofs for cash-on-delivery orders and for strangers', async () => {
      const { order, accessKey } = await placeCod();
      const cod = await http()
        .post(api(`/orders/${order.number}/payment-proof`))
        .set('X-Order-Access-Key', accessKey)
        .attach('file', PNG, { filename: 'p.png', contentType: 'image/png' });
      expect(cod.body.code).toBe('PAYMENT_PROOF_NOT_ACCEPTED');

      const transfer = await placeTransfer();
      await http()
        .post(api(`/orders/${transfer.order.number}/payment-proof`))
        .attach('file', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(404);
    });
  });

  describe('account orders', () => {
    it('lists orders placed while signed in and guest orders with the verified phone', async () => {
      const { token, phone } = await signedInCustomer();
      const signedIn = await placeCod({ token });
      const guest = await placeCod({ phone }); // no token: linked by verified phone

      const list = await http()
        .get(api('/account/orders'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.items.map((o: { number: string }) => o.number).sort()).toEqual(
        [signedIn.order.number, guest.order.number].sort(),
      );

      await http()
        .get(api(`/account/orders/${guest.order.number}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      // The owner can also use the public order route with their session.
      await http()
        .get(api(`/orders/${signedIn.order.number}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const stranger = await signedInCustomer();
      await http()
        .get(api(`/account/orders/${guest.order.number}`))
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);
      await http().get(api('/account/orders')).expect(401);
    });
  });
});
