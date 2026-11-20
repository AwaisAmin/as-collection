import { randomInt, randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { MaintenanceJobs } from '../src/jobs/maintenance.jobs.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { StaffSessionService } from '../src/modules/staff/staff-session.service.js';
import { MemoryObjectStorage, OBJECT_STORAGE } from '../src/storage/object-storage.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Staff order workflow, payment review and maintenance jobs, on real orders placed through
 * checkout. Uses variant MKUP-002-02 (stock snapshotted and restored), +92 399 phones and
 * @e2e-orders.example.test staff; sessions are created directly (sign-in is tested elsewhere).
 */
const TEST_PHONE_PREFIX = '+92399';
const STAFF_DOMAIN = '@e2e-orders.example.test';
const SKU = 'MKUP-002-02';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const newPhone = () => `${TEST_PHONE_PREFIX}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;

interface AdminOrder {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  actions: string[];
  canReviewPayment: boolean;
  delivery: { courier: string | null; trackingNumber: string | null };
  timeline: { type: string; note: string | null; customerVisible: boolean }[];
  paymentProofs: { id: string; status: string; amountMismatch: boolean }[];
}

describe('admin orders & jobs (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  let variantId: string;
  let snapshot: { onHand: number; reserved: number; allowBackorder: boolean };
  /** Tokens by role. */
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role] ?? ''}` });

  async function staffToken(roleKey: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `${roleKey}.${randomUUID().slice(0, 6)}${STAFF_DOMAIN}`,
        name: `E2E ${roleKey}`,
        passwordHash: await hashPassword(randomUUID()),
        totpEnabledAt: null,
        roles: { create: { roleId: role.id } },
      },
    });
    return (await app.get(StaffSessionService).create(staff.id, { ip: null, userAgent: 'e2e' }))
      .token;
  }

  async function place(paymentMethod = 'COD', quantity = 1) {
    const lines = [{ variantId, quantity }];
    const quote = await http().post(api('/checkout/quote')).send({ lines }).expect(200);
    const res = await http()
      .post(api('/orders'))
      .set('Idempotency-Key', randomUUID())
      .send({
        customer: { fullName: 'E2E Ayesha Malik', phone: newPhone(), email: '' },
        shipping: { line1: 'House 12, Street 4, DHA Phase 5', city: 'Lahore' },
        paymentMethod,
        lines,
        expectedTotalMinor: (quote.body as { totalMinor: number }).totalMinor,
      })
      .expect(201);
    return res.body as { order: { number: string }; accessKey: string };
  }

  const stock = async () =>
    prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId },
      select: { onHand: true, reserved: true },
    });

  const act = (number: string, action: string, body: object = {}, role = 'super-admin') =>
    http()
      .post(api(`/admin/orders/${number}/${action}`))
      .set(as(role))
      .send(body);

  const customerView = async (number: string, accessKey: string) =>
    (
      await http()
        .get(api(`/orders/${number}`))
        .set('X-Order-Access-Key', accessKey)
        .expect(200)
    ).body as { status: string; paymentStatus: string; timeline: { note: string | null }[] };

  async function cleanup() {
    const orders = await prisma.order.findMany({
      where: { phone: { startsWith: TEST_PHONE_PREFIX } },
      select: { id: true, number: true },
    });
    const staff = await prisma.staffUser.findMany({
      where: { email: { endsWith: STAFF_DOMAIN } },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: orders.map((o) => o.id) } },
            { actorStaffId: { in: staff.map((s) => s.id) } },
          ],
        },
      });
    });
    await prisma.inventoryMovement.deleteMany({
      where: { reference: { in: orders.map((o) => o.number) } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.media.deleteMany({ where: { storageKey: { startsWith: 'payment-proofs/' } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: staff.map((s) => s.id) } } });
  }

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }, (b) =>
      b.overrideProvider(OBJECT_STORAGE).useValue(new MemoryObjectStorage()),
    ));
    prisma = app.get(PrismaService);
    await cleanup();
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: SKU },
      select: { id: true, inventory: true },
    });
    variantId = variant.id;
    snapshot = {
      onHand: variant.inventory?.onHand ?? 0,
      reserved: variant.inventory?.reserved ?? 0,
      allowBackorder: variant.inventory?.allowBackorder ?? false,
    };
    for (const role of ['super-admin', 'order-manager', 'catalog-manager']) {
      tokens[role] = await staffToken(role);
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.inventoryItem.update({ where: { variantId }, data: snapshot });
    await app.close();
  });

  it('takes a COD order from placed to delivered, turning the reservation into a sale', async () => {
    const before = await stock();
    const { order, accessKey } = await place('COD', 2);
    expect(await stock()).toEqual({ onHand: before.onHand, reserved: before.reserved + 2 });

    const detail = (
      await http()
        .get(api(`/admin/orders/${order.number}`))
        .set(as('order-manager'))
        .expect(200)
    ).body as AdminOrder;
    expect(detail.actions).toEqual(['confirm', 'cancel']);
    expect(detail.timeline[0]?.type).toBe('order.placed');

    await act(
      order.number,
      'confirm',
      { note: 'Called the customer, confirmed.' },
      'order-manager',
    ).expect(200);
    const shipped = (
      await act(
        order.number,
        'ship',
        { courier: 'TCS', trackingNumber: 'TCS-778899' },
        'order-manager',
      ).expect(200)
    ).body as AdminOrder;
    expect(shipped).toMatchObject({
      status: 'SHIPPED',
      delivery: { courier: 'TCS', trackingNumber: 'TCS-778899' },
      actions: ['deliver', 'return'],
    });
    expect(await stock()).toEqual({ onHand: before.onHand - 2, reserved: before.reserved });
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { variantId, reference: order.number },
    });
    expect(movement).toMatchObject({ delta: -2, reason: 'SALE' });

    // Double click: the second "ship" is refused, stock is not taken twice.
    const again = await act(order.number, 'ship', { courier: 'TCS' }).expect(409);
    expect(again.body).toMatchObject({ code: 'INVALID_TRANSITION' });
    expect((await stock()).onHand).toBe(before.onHand - 2);

    const delivered = (await act(order.number, 'deliver').expect(200)).body as AdminOrder;
    expect(delivered).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });

    const mine = await customerView(order.number, accessKey);
    expect(mine).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
    const notes = mine.timeline.map((e) => e.note).join(' | ');
    expect(notes).toContain('Shipped with TCS — tracking number TCS-778899.');
    expect(notes).not.toContain('Called the customer'); // internal note stays internal

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: detail.id, action: 'order.ship' },
    });
    expect(audit?.actorStaffId).not.toBeNull();
  });

  it('reviews transfer screenshots: reject with a reason, then accept (confirms the order)', async () => {
    const { order, accessKey } = await place('BANK_TRANSFER');
    const blocked = await act(order.number, 'confirm').expect(409);
    expect(blocked.body).toMatchObject({ code: 'PAYMENT_NOT_VERIFIED' });

    const upload = () =>
      http()
        .post(api(`/orders/${order.number}/payment-proof`))
        .set('X-Order-Access-Key', accessKey)
        .attach('file', PNG, { filename: 'proof.png', contentType: 'image/png' })
        .field('amountMinor', '100')
        .expect(201);
    await upload();
    let detail = (
      await http()
        .get(api(`/admin/orders/${order.number}`))
        .set(as('super-admin'))
        .expect(200)
    ).body as AdminOrder;
    const first = detail.paymentProofs[0];
    expect(first).toMatchObject({ status: 'PENDING', amountMismatch: true });
    expect(detail.canReviewPayment).toBe(true);

    const link = await http()
      .get(api(`/admin/orders/${order.number}/payment-proofs/${first?.id ?? ''}/url`))
      .set(as('order-manager'))
      .expect(200);
    expect(link.body).toMatchObject({ url: expect.stringMatching(/^memory:\/\/private\//) });
    await http()
      .get(api(`/admin/orders/${order.number}/payment-proofs/${first?.id ?? ''}/url`))
      .set(as('catalog-manager'))
      .expect(403);

    detail = (
      await act(order.number, `payment-proofs/${first?.id ?? ''}/reject`, {
        reason: 'The amount does not match the order total',
      }).expect(200)
    ).body as AdminOrder;
    expect(detail.paymentStatus).toBe('FAILED');
    await act(order.number, `payment-proofs/${first?.id ?? ''}/accept`).expect(409); // already reviewed
    const rejected = await customerView(order.number, accessKey);
    expect(rejected.timeline.at(-1)?.note).toBe(
      'We could not verify your payment screenshot: The amount does not match the order total. Please upload a new one or contact us.',
    );

    await upload();
    detail = (
      await http()
        .get(api(`/admin/orders/${order.number}`))
        .set(as('super-admin'))
        .expect(200)
    ).body as AdminOrder;
    const second = detail.paymentProofs.find((p) => p.status === 'PENDING');
    detail = (
      await act(
        order.number,
        `payment-proofs/${second?.id ?? ''}/accept`,
        {},
        'order-manager',
      ).expect(200)
    ).body as AdminOrder;
    expect(detail).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      canReviewPayment: false,
    });
    expect(detail.actions).toEqual(['process', 'ship', 'cancel']);

    const views = await prisma.auditLog.count({
      where: { entityId: detail.id, action: 'payment.proof.view' },
    });
    expect(views).toBe(1);
  });

  it('cancels with a reason (stock released), refunds only paid orders', async () => {
    const before = await stock();
    const { order, accessKey } = await place('COD');
    const cancelled = (
      await act(order.number, 'cancel', { reason: 'Customer did not answer three calls.' }).expect(
        200,
      )
    ).body as AdminOrder;
    expect(cancelled.status).toBe('CANCELLED');
    expect(await stock()).toEqual(before);
    const internal = cancelled.timeline.find((e) => e.note?.startsWith('Cancellation reason'));
    expect(internal?.customerVisible).toBe(false);
    expect((await customerView(order.number, accessKey)).timeline.map((e) => e.note)).not.toContain(
      internal?.note,
    );
    await act(order.number, 'refund', {}).expect(409);
    await act(order.number, 'cancel', { reason: 'again' }).expect(409);
  });

  it('records returns, restocking on request; refunds need orders.refund', async () => {
    const before = await stock();
    const { order } = await place('COD');
    await act(order.number, 'confirm').expect(200);
    await act(order.number, 'ship', { courier: 'Leopards' }).expect(200);
    await act(order.number, 'deliver').expect(200);

    const denied = await act(order.number, 'return', { restock: true }, 'order-manager').expect(
      403,
    );
    expect(denied.body).toMatchObject({ code: 'FORBIDDEN' });
    await act(order.number, 'return', { restock: true }).expect(200);
    expect(await stock()).toEqual(before);
    const movements = await prisma.inventoryMovement.findMany({
      where: { reference: order.number },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => [m.reason, m.delta])).toEqual([
      ['SALE', -1],
      ['RETURN', 1],
    ]);
    const refunded = (await act(order.number, 'refund', { reference: 'IBFT-12345' }).expect(200))
      .body as AdminOrder;
    expect(refunded.paymentStatus).toBe('REFUNDED');
  });

  it('refuses to ship what is not physically in stock', async () => {
    const { order } = await place('COD');
    await act(order.number, 'confirm').expect(200);
    const current = await stock();
    await prisma.inventoryItem.update({
      where: { variantId },
      data: { allowBackorder: true, onHand: 0 },
    });
    try {
      const res = await act(order.number, 'ship', { courier: 'TCS' }).expect(409);
      expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', sku: SKU });
      const row = await prisma.order.findUniqueOrThrow({ where: { number: order.number } });
      expect(row.status).toBe('CONFIRMED'); // rolled back
    } finally {
      await prisma.inventoryItem.update({
        where: { variantId },
        data: { allowBackorder: snapshot.allowBackorder, onHand: current.onHand },
      });
    }
    await act(order.number, 'cancel', { reason: 'cleanup' }).expect(200);
  });

  it('searches by number, phone or name, and counts the queues', async () => {
    const { order } = await place('JAZZCASH');
    const row = await prisma.order.findUniqueOrThrow({ where: { number: order.number } });
    const local = `0${row.phone.slice(3, 6)}-${row.phone.slice(6)}`;
    const search = async (q: string) =>
      (
        (await http().get(api('/admin/orders')).query({ q }).set(as('order-manager')).expect(200))
          .body as {
          items: { number: string }[];
        }
      ).items.map((i) => i.number);

    expect(await search(order.number.toLowerCase().replaceAll('-', ''))).toEqual([order.number]);
    expect(await search(local)).toEqual([order.number]);
    expect(await search('ayesha mal')).toContain(order.number);

    const filtered = await http()
      .get(api('/admin/orders'))
      .query({ status: 'PENDING', paymentMethod: 'JAZZCASH,EASYPAISA', pageSize: 100 })
      .set(as('order-manager'))
      .expect(200);
    const items = (filtered.body as { items: { number: string; paymentMethod: string }[] }).items;
    expect(items.map((i) => i.number)).toContain(order.number);
    expect(items.every((i) => i.paymentMethod !== 'COD')).toBe(true);
    await http()
      .get(api('/admin/orders'))
      .query({ status: 'LOST' })
      .set(as('order-manager'))
      .expect(422);

    const counts = await http()
      .get(api('/admin/orders/counts'))
      .set(as('order-manager'))
      .expect(200);
    expect(counts.body).toMatchObject({
      toConfirm: expect.any(Number),
      awaitingPaymentReview: expect.any(Number),
    });
    await http().get(api('/admin/orders')).set(as('catalog-manager')).expect(403);
    await http().get(api('/admin/orders')).expect(401);
  });

  describe('jobs', () => {
    it('cancels transfer orders unpaid past the window, but not ones awaiting review', async () => {
      const before = await stock();
      const unpaid = await place('EASYPAISA');
      const reviewing = await place('BANK_TRANSFER');
      await http()
        .post(api(`/orders/${reviewing.order.number}/payment-proof`))
        .set('X-Order-Access-Key', reviewing.accessKey)
        .attach('file', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      const old = new Date(Date.now() - 49 * 3_600_000);
      await prisma.order.updateMany({
        where: { number: { in: [unpaid.order.number, reviewing.order.number] } },
        data: { placedAt: old },
      });

      const result = await app.get(MaintenanceJobs).cancelUnpaidTransfers();
      expect(result.cancelled).toBeGreaterThanOrEqual(1);

      const cancelled = await customerView(unpaid.order.number, unpaid.accessKey);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.timeline.at(-1)?.note).toMatch(
        /^Cancelled automatically: we did not receive/,
      );
      expect((await customerView(reviewing.order.number, reviewing.accessKey)).status).toBe(
        'PENDING',
      );
      expect((await stock()).reserved).toBe(before.reserved + 1); // only the reviewing order holds stock

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          action: 'order.cancel',
          entityType: 'order',
          changes: { path: ['number'], equals: unpaid.order.number },
        },
      });
      expect(audit).toMatchObject({ actorType: 'SYSTEM', actorStaffId: null });
      await act(reviewing.order.number, 'cancel', { reason: 'cleanup' }).expect(200);
    });

    it('deletes expired auth data in batches', async () => {
      const phone = newPhone();
      const longAgo = new Date(Date.now() - 40 * 86_400_000);
      const challenge = await prisma.otpChallenge.create({
        data: {
          phone,
          codeHash: 'c'.repeat(64),
          channel: 'SMS',
          expiresAt: longAgo,
          createdAt: longAgo,
        },
      });
      const result = await app.get(MaintenanceJobs).cleanupAuth();
      expect(result.otpChallenges).toBeGreaterThanOrEqual(1);
      expect(await prisma.otpChallenge.findUnique({ where: { id: challenge.id } })).toBeNull();
      expect(Object.keys(result).sort()).toEqual([
        'customerSessions',
        'otpChallenges',
        'staffSessions',
        'stockReservations',
      ]);
    });
  });
});
