import { randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { SETTINGS_CACHE } from '../src/modules/orders/store-settings.service.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { StaffSessionService } from '../src/modules/staff/staff-session.service.js';
import { CacheService } from '../src/redis/cache.service.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Discount codes, pages and sections, menus and settings, as staff. Test data uses the
 * "e2e-content" page / menu, "E2EC" codes and @e2e-content.example.test staff; the `shipping`
 * setting is snapshotted and restored.
 */
const STAFF_DOMAIN = '@e2e-content.example.test';
const SKU = 'MKUP-002-02';

interface Page {
  id: string;
  slug: string;
  updatedAt: string;
  sections: { id: string; type: string; valid: boolean; live: boolean; updatedAt: string }[];
}

describe('admin content & discounts (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  let shippingSnapshot: Prisma.JsonValue | undefined;
  let variantId: string;

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const as = (role = 'super-admin') => ({ Authorization: `Bearer ${tokens[role] ?? ''}` });
  const send = <T>(
    method: 'post' | 'patch' | 'put',
    path: string,
    body: object,
    status: number,
    role?: string,
  ) =>
    http()
      [method](api(path))
      .set(as(role))
      .send(body)
      .expect(status)
      .then((r) => r.body as T);

  async function staffToken(roleKey: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    const staff = await prisma.staffUser.create({
      data: {
        email: `${roleKey}.${randomUUID().slice(0, 6)}${STAFF_DOMAIN}`,
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
      where: { email: { endsWith: STAFF_DOMAIN } },
      select: { id: true },
    });
    const staffIds = staff.map((s) => s.id);
    await prisma.discount.deleteMany({ where: { code: { startsWith: 'E2EC' } } });
    await prisma.page.deleteMany({ where: { slug: { startsWith: 'e2e-content' } } });
    await prisma.menu.deleteMany({ where: { key: { startsWith: 'e2e-content' } } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({ where: { actorStaffId: { in: staffIds } } });
    });
    await prisma.setting.updateMany({
      where: { updatedByStaffId: { in: staffIds } },
      data: { updatedByStaffId: null },
    });
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  }

  const quote = (discountCode?: string) =>
    send<{
      shippingMinor: number;
      discountMinor: number;
      discount: { applied: boolean; reason?: string } | null;
    }>(
      'post',
      '/checkout/quote',
      { lines: [{ variantId, quantity: 1 }], ...(discountCode ? { discountCode } : {}) },
      200,
    );

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }));
    prisma = app.get(PrismaService);
    await cleanup();
    shippingSnapshot = (await prisma.setting.findUnique({ where: { key: 'shipping' } }))?.value;
    variantId = (await prisma.productVariant.findUniqueOrThrow({ where: { sku: SKU } })).id;
    for (const role of ['super-admin', 'catalog-manager', 'content-editor', 'order-manager']) {
      tokens[role] = await staffToken(role);
    }
  });

  afterAll(async () => {
    if (shippingSnapshot !== undefined) {
      await prisma.setting.update({
        where: { key: 'shipping' },
        data: { value: shippingSnapshot as Prisma.InputJsonValue },
      });
      await app.get(CacheService).invalidate(SETTINGS_CACHE);
    }
    await cleanup();
    await app.close();
  });

  describe('discount codes', () => {
    it('creates a code checkout accepts, then stops accepting when deactivated', async () => {
      const created = await send<{ id: string; code: string; state: string; updatedAt: string }>(
        'post',
        '/admin/discounts',
        { code: 'e2ec-flat', type: 'FIXED_AMOUNT', value: 10_000 },
        201,
        'catalog-manager',
      );
      expect(created).toMatchObject({ code: 'E2EC-FLAT', state: 'active' });
      expect((await quote('E2EC-FLAT')).discountMinor).toBe(10_000);

      await send(
        'post',
        '/admin/discounts',
        { code: 'E2EC-FLAT', type: 'FREE_SHIPPING' },
        409,
        'catalog-manager',
      );
      const off = await send<{ state: string }>(
        'patch',
        `/admin/discounts/${created.id}`,
        { isActive: false, updatedAt: created.updatedAt },
        200,
        'catalog-manager',
      );
      expect(off.state).toBe('inactive');
      expect((await quote('E2EC-FLAT')).discount?.applied).toBe(false);

      const listed = await http()
        .get(api('/admin/discounts?q=e2ec&state=inactive'))
        .set(as('order-manager'))
        .expect(200);
      expect((listed.body as { items: { code: string }[] }).items.map((d) => d.code)).toEqual([
        'E2EC-FLAT',
      ]);
      await send(
        'post',
        '/admin/discounts',
        { code: 'E2EC-X', type: 'FREE_SHIPPING' },
        403,
        'order-manager',
      );
    });

    it('keeps used codes: no rename, no limit below usage, no delete', async () => {
      const code = await send<{ id: string; updatedAt: string }>(
        'post',
        '/admin/discounts',
        { code: 'E2EC-USED', type: 'PERCENTAGE', value: 1000, usageLimit: 10 },
        201,
      );
      await prisma.discount.update({ where: { id: code.id }, data: { usageCount: 3 } });
      const fresh = await prisma.discount.findUniqueOrThrow({ where: { id: code.id } });
      const refused = await send<{ errors: { path: string }[] }>(
        'patch',
        `/admin/discounts/${code.id}`,
        { code: 'E2EC-RENAMED', usageLimit: 2, updatedAt: fresh.updatedAt.toISOString() },
        422,
      );
      expect(refused.errors.map((e) => e.path)).toEqual(['code', 'usageLimit']);
      // Type change re-validates the value: 1000 is not a valid free-shipping value.
      await send(
        'patch',
        `/admin/discounts/${code.id}`,
        { type: 'FREE_SHIPPING', updatedAt: fresh.updatedAt.toISOString() },
        422,
      );
    });
  });

  describe('settings', () => {
    it('changes the delivery fee checkout charges, at once', async () => {
      const current = (await http().get(api('/admin/settings/shipping')).set(as()).expect(200))
        .body as {
        value: {
          flatFeeMinor: number;
          freeShippingThresholdMinor: number;
          returnWindowDays: number;
        };
        updatedAt: string;
      };
      expect((await quote()).shippingMinor).toBe(current.value.flatFeeMinor);

      const saved = await send<{ value: { flatFeeMinor: number }; updatedBy: { name: string } }>(
        'put',
        '/admin/settings/shipping',
        {
          value: { ...current.value, flatFeeMinor: 31_500, junk: true },
          updatedAt: current.updatedAt,
        },
        200,
      );
      expect(saved.value).toEqual({ ...current.value, flatFeeMinor: 31_500 });
      expect(saved.updatedBy.name).toBe('E2E super-admin');
      expect((await quote()).shippingMinor).toBe(31_500);

      const stale = await send<{ code: string }>(
        'put',
        '/admin/settings/shipping',
        { value: current.value, updatedAt: current.updatedAt },
        409,
      );
      expect(stale.code).toBe('STALE_UPDATE');
      const invalid = await send<{ errors: { path: string }[] }>(
        'put',
        '/admin/settings/shipping',
        { value: { ...current.value, flatFeeMinor: -1 }, updatedAt: null },
        422,
      );
      expect(invalid.errors[0]?.path).toBe('value.flatFeeMinor');
      await send('put', '/admin/settings/nope', { value: 1, updatedAt: null }, 404);
      await send(
        'put',
        '/admin/settings/shipping',
        { value: current.value, updatedAt: null },
        403,
        'content-editor',
      );
    });
  });

  describe('pages and sections', () => {
    let page: Page;

    it('builds a page from validated sections, live only when published', async () => {
      page = await send<Page>(
        'post',
        '/admin/pages',
        { slug: 'e2e-content-about', title: 'About us' },
        201,
        'content-editor',
      );
      page = await send<Page>(
        'post',
        `/admin/pages/${page.id}/sections`,
        { type: 'testimonials', settings: { title: 'Loved by you', limit: 6 } },
        201,
        'content-editor',
      );
      page = await send<Page>(
        'post',
        `/admin/pages/${page.id}/sections`,
        {
          type: 'brand-story',
          position: 0,
          settings: {
            title: 'Our story',
            script: 'Since 2019',
            image: { src: '/images/story.jpg', alt: 'Atelier' },
            cta: { label: 'Read more', href: '/about' },
          },
        },
        201,
        'content-editor',
      );
      expect(page.sections.map((s) => [s.type, s.valid, s.live])).toEqual([
        ['brand-story', true, true],
        ['testimonials', true, true],
      ]);

      const bad = await send<{ errors: { path: string }[] }>(
        'post',
        `/admin/pages/${page.id}/sections`,
        { type: 'testimonials', settings: { title: '', limit: 99 } },
        422,
        'content-editor',
      );
      expect(bad.errors.map((e) => e.path)).toEqual(['settings.title', 'settings.limit']);

      await http().get(api('/content/pages/e2e-content-about')).expect(404); // draft
      page = await send<Page>(
        'patch',
        `/admin/pages/${page.id}`,
        { status: 'PUBLISHED', updatedAt: page.updatedAt },
        200,
        'content-editor',
      );
      const live = await http().get(api('/content/pages/e2e-content-about')).expect(200);
      expect((live.body as { sections: { type: string }[] }).sections.map((s) => s.type)).toEqual([
        'brand-story',
        'testimonials',
      ]);
    });

    it('reorders, hides and deletes sections, refreshing the storefront', async () => {
      const [story, testimonials] = page.sections;
      page = await send<Page>(
        'post',
        `/admin/pages/${page.id}/sections/reorder`,
        { ids: [testimonials?.id, story?.id] },
        200,
        'content-editor',
      );
      page = await send<Page>(
        'patch',
        `/admin/pages/${page.id}/sections/${story?.id ?? ''}`,
        { isVisible: false, updatedAt: page.sections[1]?.updatedAt },
        200,
        'content-editor',
      );
      const live = await http().get(api('/content/pages/e2e-content-about')).expect(200);
      expect((live.body as { sections: { type: string }[] }).sections.map((s) => s.type)).toEqual([
        'testimonials',
      ]);

      await http()
        .delete(api(`/admin/pages/${page.id}/sections/${story?.id ?? ''}`))
        .set(as('content-editor'))
        .expect(200);
      await http()
        .delete(api(`/admin/pages/${page.id}`))
        .set(as('content-editor'))
        .expect(204);
    });

    it('protects the home page', async () => {
      const home = await prisma.page.findUniqueOrThrow({ where: { slug: 'home' } });
      const res = await send<{ code: string }>(
        'patch',
        `/admin/pages/${home.id}`,
        { status: 'DRAFT', updatedAt: home.updatedAt.toISOString() },
        409,
        'content-editor',
      );
      expect(res.code).toBe('PAGE_PROTECTED');
      await http()
        .delete(api(`/admin/pages/${home.id}`))
        .set(as('content-editor'))
        .expect(409);
    });
  });

  describe('menus', () => {
    it('creates and replaces a menu tree, keeping hidden items out of the storefront', async () => {
      const created = await send<{
        updatedAt: string;
        items: { label: string; children: unknown[] }[];
      }>(
        'put',
        '/admin/menus/e2e-content',
        {
          name: 'E2E menu',
          updatedAt: null,
          items: [
            { label: 'Shop', url: '/shop', children: [{ label: 'Lawn', url: '/shop/unstitched' }] },
            { label: 'Secret', url: '/secret', isVisible: false },
          ],
        },
        200,
        'content-editor',
      );
      expect(created.items.map((i) => [i.label, i.children.length])).toEqual([
        ['Shop', 1],
        ['Secret', 0],
      ]);
      const live = await http().get(api('/content/menus/e2e-content')).expect(200);
      expect((live.body as { items: { label: string }[] }).items.map((i) => i.label)).toEqual([
        'Shop',
      ]);

      await send(
        'put',
        '/admin/menus/e2e-content',
        { name: 'E2E menu', updatedAt: null, items: [] },
        409,
        'content-editor',
      );
      await send(
        'put',
        '/admin/menus/e2e-content',
        {
          name: 'E2E menu',
          updatedAt: created.updatedAt,
          items: [{ label: 'Bad', url: 'javascript:alert(1)' }],
        },
        422,
        'content-editor',
      );
      const replaced = await send<{ items: { label: string }[] }>(
        'put',
        '/admin/menus/e2e-content',
        {
          name: 'E2E menu',
          updatedAt: created.updatedAt,
          items: [{ label: 'Sale', url: '/shop?sale=1' }],
        },
        200,
        'content-editor',
      );
      expect(replaced.items.map((i) => i.label)).toEqual(['Sale']);
      const after = await http().get(api('/content/menus/e2e-content')).expect(200);
      expect((after.body as { items: { label: string }[] }).items.map((i) => i.label)).toEqual([
        'Sale',
      ]);

      await http().delete(api('/admin/menus/main')).set(as('content-editor')).expect(409);
      await http().delete(api('/admin/menus/e2e-content')).set(as('content-editor')).expect(204);
    });
  });
});
