import { randomInt, randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { SessionService } from '../src/modules/auth/session.service.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { StaffSessionService } from '../src/modules/staff/staff-session.service.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Review moderation, contact inbox, newsletter export and customer accounts, as staff. Test
 * rows are marked "E2E Mod" / @e2e-mod.example.test / +92397 phones and removed afterwards.
 */
const DOMAIN = '@e2e-mod.example.test';
const PHONE_PREFIX = '+92397';
const SKU = 'MKUP-002-02';
const newPhone = () => `${PHONE_PREFIX}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;

interface AdminReview {
  id: string;
  status: string;
  isFeatured: boolean;
  reply: string | null;
}

describe('admin moderation (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  let product: { id: string; slug: string; ratingCount: number };

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role] ?? ''}` });

  async function staffToken(roleKey: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `${roleKey}.${randomUUID().slice(0, 6)}${DOMAIN}`,
        name: `E2E ${roleKey}`,
        passwordHash: await hashPassword(randomUUID()),
        roles: { create: { roleId: role.id } },
      },
    });
    return (await app.get(StaffSessionService).create(staff.id, { ip: null, userAgent: 'e2e' }))
      .token;
  }

  async function cleanup() {
    const staff = await prisma.staffUser.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    const staffIds = staff.map((s) => s.id);
    await prisma.review.deleteMany({ where: { authorName: { startsWith: 'E2E Mod' } } });
    await prisma.contactMessage.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await prisma.newsletterSubscriber.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await prisma.customer.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({ where: { actorStaffId: { in: staffIds } } });
    });
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  }

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }));
    prisma = app.get(PrismaService);
    await cleanup();
    for (const role of ['super-admin', 'catalog-manager', 'content-editor']) {
      tokens[role] = await staffToken(role);
    }
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: SKU },
      select: { product: { select: { id: true, slug: true, ratingCount: true } } },
    });
    product = variant.product;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('reviews', () => {
    let review: AdminReview;

    it('publishes a pending review with a store reply, updating the rating', async () => {
      const created = await prisma.review.create({
        data: {
          productId: product.id,
          authorName: 'E2E Mod Sana',
          rating: 4,
          title: 'Lovely shade',
          body: 'Stays on all day and the colour is exactly as pictured. Will buy again.',
        },
      });
      const counts = await http()
        .get(api('/admin/reviews/counts'))
        .set(as('super-admin'))
        .expect(200);
      expect((counts.body as { PENDING: number }).PENDING).toBeGreaterThanOrEqual(1);

      review = (
        await http()
          .post(api(`/admin/reviews/${created.id}/approve`))
          .set(as('super-admin'))
          .expect(200)
      ).body as AdminReview;
      expect(review.status).toBe('APPROVED');
      const rated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(rated.ratingCount).toBe(product.ratingCount + 1);

      await http()
        .put(api(`/admin/reviews/${review.id}/reply`))
        .set(as('super-admin'))
        .send({ reply: 'Thank you, Sana! So glad you love it.' })
        .expect(200);
      const publicList = await http()
        .get(api(`/catalog/products/${product.slug}/reviews?sort=newest`))
        .expect(200);
      const shown = (
        publicList.body as { items: { id: string; reply: { body: string } | null }[] }
      ).items.find((r) => r.id === review.id);
      expect(shown?.reply?.body).toBe('Thank you, Sana! So glad you love it.');
    });

    it('puts staff picks first in the home testimonials', async () => {
      await http()
        .put(api(`/admin/reviews/${review.id}/featured`))
        .set(as('super-admin'))
        .send({ featured: true })
        .expect(200);
      const featured = await http().get(api('/catalog/reviews/featured?limit=3')).expect(200);
      expect((featured.body as { id: string }[])[0]?.id).toBe(review.id);
    });

    it('rejects (unpublishes and unfeatures) with an internal reason', async () => {
      const rejected = (
        await http()
          .post(api(`/admin/reviews/${review.id}/reject`))
          .set(as('super-admin'))
          .send({ reason: 'Posted by a competitor.' })
          .expect(200)
      ).body as AdminReview;
      expect(rejected).toMatchObject({ status: 'REJECTED', isFeatured: false });
      const rated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(rated.ratingCount).toBe(product.ratingCount);
      await http()
        .put(api(`/admin/reviews/${review.id}/featured`))
        .set(as('super-admin'))
        .send({ featured: true })
        .expect(409);
      await http().get(api('/admin/reviews')).set(as('catalog-manager')).expect(403);
    });
  });

  it('runs the contact inbox: search, read, note, archive', async () => {
    const message = await prisma.contactMessage.create({
      data: {
        name: 'E2E Mod Hina',
        email: `hina${DOMAIN}`,
        topic: 'ORDER',
        message: 'My parcel has not arrived yet, can you check please?',
      },
    });
    const found = await http()
      .get(api(`/admin/inbox?status=NEW&q=hina${DOMAIN}`))
      .set(as('super-admin'))
      .expect(200);
    expect((found.body as { items: { id: string; preview: string }[] }).items[0]).toMatchObject({
      id: message.id,
      preview: 'My parcel has not arrived yet, can you check please?',
    });
    const handled = await http()
      .patch(api(`/admin/inbox/${message.id}`))
      .set(as('super-admin'))
      .send({ status: 'ARCHIVED', staffNote: 'Called her; courier delayed.' })
      .expect(200);
    expect(handled.body).toMatchObject({
      status: 'ARCHIVED',
      staffNote: 'Called her; courier delayed.',
      handledBy: { name: 'E2E super-admin' },
    });
  });

  it('exports subscribers as CSV, safely and audited', async () => {
    await prisma.newsletterSubscriber.create({ data: { email: `=cmd${DOMAIN}` } });
    const res = await http()
      .get(api('/admin/newsletter/export.csv'))
      .set(as('super-admin'))
      .buffer(true)
      .parse((r, done) => {
        let text = '';
        r.on('data', (c: Buffer) => (text += c.toString()));
        r.on('end', () => {
          done(null, text);
        });
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="subscribers-subscribed-/,
    );
    const text = res.body as string;
    expect(text.startsWith('email,status,source,consent_at,unsubscribed_at\r\n')).toBe(true);
    expect(text).toContain(`'=cmd${DOMAIN},SUBSCRIBED`);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'newsletter.export' },
      orderBy: { id: 'desc' },
    });
    expect(audit?.changes).toMatchObject({ status: 'SUBSCRIBED' });
    await http().get(api('/admin/newsletter/export.csv')).set(as('content-editor')).expect(403);
  });

  it('blocks a customer: signed out everywhere at once, then unblocked', async () => {
    const phone = newPhone();
    const customer = await prisma.customer.create({
      data: { phone, name: 'E2E Mod Ayesha', phoneVerifiedAt: new Date() },
    });
    const { token } = await app
      .get(SessionService)
      .create(customer.id, { ip: null, userAgent: 'e2e' });
    await http().get(api('/account')).set('Authorization', `Bearer ${token}`).expect(200);

    const local = `0${phone.slice(3, 6)} ${phone.slice(6)}`;
    const search = await http()
      .get(api(`/admin/customers?q=${encodeURIComponent(local)}`))
      .set(as('super-admin'))
      .expect(200);
    expect((search.body as { items: { id: string }[] }).items.map((c) => c.id)).toEqual([
      customer.id,
    ]);

    const blocked = await http()
      .post(api(`/admin/customers/${customer.id}/block`))
      .set(as('super-admin'))
      .send({ reason: 'Repeated fake COD orders.' })
      .expect(200);
    expect(blocked.body).toMatchObject({
      status: 'BLOCKED',
      blockedReason: 'Repeated fake COD orders.',
      signedOutSessions: 1,
    });
    await http().get(api('/account')).set('Authorization', `Bearer ${token}`).expect(401);

    const unblocked = await http()
      .post(api(`/admin/customers/${customer.id}/unblock`))
      .set(as('super-admin'))
      .expect(200);
    expect(unblocked.body).toMatchObject({ status: 'ACTIVE', blockedReason: null });

    const edited = await http()
      .patch(api(`/admin/customers/${customer.id}`))
      .set(as('super-admin'))
      .send({
        staffNote: 'Verified by phone.',
        updatedAt: (unblocked.body as { updatedAt: string }).updatedAt,
      })
      .expect(200);
    expect((edited.body as { staffNote: string }).staffNote).toBe('Verified by phone.');
    await http()
      .post(api(`/admin/customers/${customer.id}/block`))
      .set(as('content-editor'))
      .send({ reason: 'xyz' })
      .expect(403);
  });
});
