import { randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { StaffSessionService } from '../src/modules/staff/staff-session.service.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Categories, attributes, brands and collections, as staff. Everything created here is named
 * "E2E Tax …" (slugs / codes start with "e2e-tax") and removed afterwards.
 */
const STAFF_DOMAIN = '@e2e-taxonomy.example.test';
const PREFIX = 'e2e-tax';

interface Category {
  id: string;
  slug: string;
  parentId: string | null;
  depth: number;
  updatedAt: string;
  children: Category[];
}
interface Attribute {
  id: string;
  code: string;
  updatedAt: string;
  values: { id: string; value: string; label: string }[];
}
interface Collection {
  id: string;
  slug: string;
  type: string;
  state: string;
  productCount: number;
  updatedAt: string;
}

describe('admin taxonomy (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const as = (role = 'catalog-manager') => ({ Authorization: `Bearer ${tokens[role] ?? ''}` });

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
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.collection.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.brand.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.tag.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    const categories = await prisma.category.findMany({
      where: { slug: { startsWith: PREFIX } },
      orderBy: { depth: 'desc' },
      select: { id: true },
    });
    for (const c of categories) await prisma.category.delete({ where: { id: c.id } });
    await prisma.attribute.deleteMany({ where: { code: { startsWith: PREFIX } } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({ where: { actorStaffId: { in: staffIds } } });
    });
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  }

  const post = <T>(path: string, body: object, status = 201, role?: string) =>
    http()
      .post(api(path))
      .set(as(role))
      .send(body)
      .expect(status)
      .then((r) => r.body as T);
  const patch = <T>(path: string, body: object, status = 200) =>
    http()
      .patch(api(path))
      .set(as())
      .send(body)
      .expect(status)
      .then((r) => r.body as T);

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }));
    prisma = app.get(PrismaService);
    await cleanup();
    for (const role of ['catalog-manager', 'content-editor']) tokens[role] = await staffToken(role);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('categories', () => {
    let root: Category;
    let child: Category;
    let grandchild: Category;
    let other: Category;

    it('builds a tree that shows on the storefront at once', async () => {
      await http().get(api('/catalog/categories')).expect(200); // warm the cache
      root = await post<Category>('/admin/categories', {
        name: 'E2E Tax Root',
        banner: { eyebrow: 'New', description: null, focus: '50% 30%' },
      });
      expect(root).toMatchObject({ slug: 'e2e-tax-root', depth: 0, parentId: null });
      child = await post<Category>('/admin/categories', {
        name: 'E2E Tax Child',
        parentId: root.id,
      });
      grandchild = await post<Category>('/admin/categories', {
        name: 'E2E Tax Grandchild',
        parentId: child.id,
      });
      expect(grandchild.depth).toBe(2);
      other = await post<Category>('/admin/categories', { name: 'E2E Tax Other' });

      const storefront = await http()
        .get(api('/catalog/categories/e2e-tax-grandchild'))
        .expect(200);
      expect(
        (storefront.body as { breadcrumbs: { slug: string }[] }).breadcrumbs.map((b) => b.slug),
      ).toEqual(['e2e-tax-root', 'e2e-tax-child']);
      const stored = await prisma.category.findUniqueOrThrow({ where: { id: root.id } });
      expect(stored.banner).toEqual({ eyebrow: 'New', focus: '50% 30%' });
    });

    it('moves a subtree, and never inside itself', async () => {
      const moved = await patch<Category>(`/admin/categories/${child.id}`, {
        parentId: other.id,
        updatedAt: child.updatedAt,
      });
      expect(moved).toMatchObject({ parentId: other.id, depth: 1 });
      const leaf = await prisma.category.findUniqueOrThrow({ where: { id: grandchild.id } });
      expect(leaf.path).toBe(`/${other.id}/${child.id}/${grandchild.id}/`);
      expect(leaf.depth).toBe(2);

      const cycle = await patch<{ errors: { path: string }[] }>(
        `/admin/categories/${other.id}`,
        { parentId: grandchild.id, updatedAt: other.updatedAt },
        422,
      );
      expect(cycle.errors[0]?.path).toBe('parentId');

      const stale = await patch<{ code: string }>(
        `/admin/categories/${child.id}`,
        { name: 'E2E Tax Late', updatedAt: child.updatedAt },
        409,
      );
      expect(stale.code).toBe('STALE_UPDATE');
      child = moved;
    });

    it('reorders siblings and refuses to delete a parent', async () => {
      const second = await post<Category>('/admin/categories', {
        name: 'E2E Tax Second',
        parentId: other.id,
      });
      const tree = await post<Category[]>(
        '/admin/categories/reorder',
        { parentId: other.id, ids: [second.id, child.id] },
        200,
      );
      const node = tree.find((c) => c.id === other.id);
      expect(node?.children.map((c) => c.slug)).toEqual(['e2e-tax-second', 'e2e-tax-child']);
      await post('/admin/categories/reorder', { parentId: other.id, ids: [second.id] }, 422);

      const res = await http()
        .delete(api(`/admin/categories/${other.id}`))
        .set(as())
        .expect(409);
      expect((res.body as { code: string }).code).toBe('CATEGORY_HAS_CHILDREN');
      await http()
        .delete(api(`/admin/categories/${second.id}`))
        .set(as())
        .expect(204);
    });
  });

  describe('attributes, products and collections', () => {
    let weave: Attribute;
    let category: Category;
    let productId: string;

    it('creates attributes with URL-safe codes and values', async () => {
      weave = await post<Attribute>('/admin/attributes', {
        name: 'E2E Tax Weave',
        type: 'SELECT',
        values: [{ label: 'Plain' }, { label: 'Twill', swatch: '#AA3311' }],
      });
      expect(weave.code).toBe('e2e-tax-weave');
      expect(weave.values.map((v) => v.value)).toEqual(['plain', 'twill']);

      const again = await post<Attribute>(`/admin/attributes/${weave.id}/values`, {
        label: 'Plain',
      });
      expect(again.values.map((v) => v.value)).toContain('plain-2');
      await post(`/admin/attributes/${weave.id}/values`, { label: 'Twill', value: 'twill' }, 422);
      weave = again;
    });

    it('protects attributes that products use', async () => {
      category = await post<Category>('/admin/categories', { name: 'E2E Tax Fabrics' });
      const twill = weave.values.find((v) => v.value === 'twill')?.id;
      const product = await post<{ id: string }>('/admin/products', {
        name: 'E2E Tax Twill Shirt',
        status: 'ACTIVE',
        primaryCategoryId: category.id,
        tags: ['E2E Tax Winter'],
        attributes: [{ attributeId: weave.id, valueIds: [twill] }],
        variants: [{ sku: 'E2E-TAX-001', priceMinor: 300_000, inventory: { onHand: 3 } }],
      });
      productId = product.id;

      const typeChange = await patch<{ code: string }>(
        `/admin/attributes/${weave.id}`,
        { type: 'MULTI_SELECT', updatedAt: weave.updatedAt },
        409,
      );
      expect(typeChange.code).toBe('ATTRIBUTE_IN_USE');
      const used = await http()
        .delete(api(`/admin/attributes/${weave.id}/values/${twill ?? ''}`))
        .set(as())
        .expect(409);
      expect((used.body as { code: string }).code).toBe('VALUE_IN_USE');
      const unused = weave.values.find((v) => v.value === 'plain-2')?.id ?? '';
      await http()
        .delete(api(`/admin/attributes/${weave.id}/values/${unused}`))
        .set(as())
        .expect(200);
      await http()
        .delete(api(`/admin/attributes/${weave.id}`))
        .set(as())
        .expect(409);
      await http()
        .delete(api(`/admin/categories/${category.id}`))
        .set(as())
        .expect(409);
    });

    it('runs automated collections on checked rules', async () => {
      const bad = await post<{ errors: { path: string; message: string }[] }>(
        '/admin/collections/preview',
        {
          rules: {
            all: [
              { field: 'attribute', op: 'in', code: 'e2e-tax-weave', value: ['denim'] },
              { field: 'tag', op: 'in', value: ['e2e-tax-nope'] },
            ],
          },
        },
        422,
      );
      expect(bad.errors.map((e) => e.path)).toEqual(['rules.all.0', 'rules.all.1']);

      const rules = {
        all: [
          { field: 'attribute', op: 'in', code: 'e2e-tax-weave', value: ['twill'] },
          { field: 'tag', op: 'in', value: ['e2e-tax-winter'] },
        ],
      };
      const preview = await post<{ count: number; sample: { id: string }[] }>(
        '/admin/collections/preview',
        { rules },
        200,
      );
      expect(preview).toMatchObject({ count: 1, sample: [{ id: productId }] });

      const winter = await post<Collection>('/admin/collections', {
        name: 'E2E Tax Winter Edit',
        type: 'AUTOMATED',
        rules,
      });
      expect(winter).toMatchObject({ slug: 'e2e-tax-winter-edit', state: 'live', productCount: 1 });
      const listing = await http()
        .get(api('/catalog/products?collection=e2e-tax-winter-edit'))
        .expect(200);
      expect((listing.body as { items: { id: string }[] }).items.map((p) => p.id)).toEqual([
        productId,
      ]);
      await http()
        .put(api(`/admin/collections/${winter.id}/products`))
        .set(as())
        .send({ productIds: [productId] })
        .expect(409);
    });

    it('keeps hand-picked collections in order, scheduled ones hidden', async () => {
      const picks = await post<Collection>('/admin/collections', {
        name: 'E2E Tax Picks',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(picks.state).toBe('scheduled');
      const filled = await http()
        .put(api(`/admin/collections/${picks.id}/products`))
        .set(as())
        .send({ productIds: [productId] })
        .expect(200);
      expect((filled.body as { products: { id: string }[] }).products.map((p) => p.id)).toEqual([
        productId,
      ]);
      await http().get(api('/catalog/collections/e2e-tax-picks')).expect(404);

      const live = await patch<Collection>(`/admin/collections/${picks.id}`, {
        startsAt: null,
        updatedAt: (filled.body as Collection).updatedAt,
      });
      expect(live).toMatchObject({ state: 'live', productCount: 1 });
      await http().get(api('/catalog/collections/e2e-tax-picks')).expect(200);
    });
  });

  it('manages brands and keeps writes to catalog staff', async () => {
    const brand = await post<{ id: string; slug: string; updatedAt: string }>('/admin/brands', {
      name: 'E2E Tax Atelier',
    });
    expect(brand.slug).toBe('e2e-tax-atelier');
    const renamed = await patch<{ name: string }>(`/admin/brands/${brand.id}`, {
      name: 'E2E Tax Atelier Studio',
      updatedAt: brand.updatedAt,
    });
    expect(renamed.name).toBe('E2E Tax Atelier Studio');
    await http()
      .delete(api(`/admin/brands/${brand.id}`))
      .set(as())
      .expect(204);

    await post('/admin/categories', { name: 'E2E Tax Nope' }, 403, 'content-editor');
    await http().get(api('/admin/attributes')).expect(401);
  });
});
