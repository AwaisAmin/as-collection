import { randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import sharp from 'sharp';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { hashPassword } from '../src/modules/staff/security/password.js';
import { StaffSessionService } from '../src/modules/staff/staff-session.service.js';
import { MemoryObjectStorage, OBJECT_STORAGE } from '../src/storage/object-storage.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Image library, product editing and stock management, as staff. Everything created here uses
 * the "e2e-cat" slug / "E2E-CAT-" SKU prefix and @e2e-catalog.example.test staff, and is removed
 * afterwards. Images go to in-memory storage.
 */
const STAFF_DOMAIN = '@e2e-catalog.example.test';
const SLUG_PREFIX = 'e2e-cat';

const photo = (width: number, height: number, colour: string) =>
  sharp({ create: { width, height, channels: 3, background: colour } })
    .jpeg()
    .toBuffer();

interface Product {
  id: string;
  slug: string;
  status: string;
  updatedAt: string;
  tags: { slug: string }[];
  attributes: { attributeId: string; valueIds?: string[] }[];
  media: { mediaId: string; variantSku: string | null }[];
  variants: {
    id: string;
    sku: string;
    isActive: boolean;
    options: { attribute: string; value: string }[];
    inventory: { onHand: number; reserved: number; available: number } | null;
  }[];
}

describe('admin catalog (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  const storage = new MemoryObjectStorage();
  const tokens: Record<string, string> = {};
  let categoryId: string;
  let fabric: { id: string; lawn: string };
  let size: { id: string; values: string[] };
  let imageId: string;
  let product: Product;

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
    await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.tag.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.media.deleteMany({ where: { uploadedByStaffId: { in: staffIds } } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.audit_purge = 'on'`;
      await tx.auditLog.deleteMany({ where: { actorStaffId: { in: staffIds } } });
    });
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  }

  const variant = (sku: string, sizeValue: string, onHand = 5) => ({
    sku,
    priceMinor: 450_000,
    compareAtPriceMinor: 520_000,
    options: [{ attributeId: size.id, valueId: sizeValue }],
    inventory: { onHand, lowStockThreshold: 3 },
  });

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '1000', AUTH_RATE_LIMIT_MAX: '1000' }, (b) =>
      b.overrideProvider(OBJECT_STORAGE).useValue(storage),
    ));
    prisma = app.get(PrismaService);
    await cleanup();
    for (const role of ['super-admin', 'catalog-manager', 'order-manager', 'content-editor']) {
      tokens[role] = await staffToken(role);
    }
    categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'unstitched' } })).id;
    const fabricRow = await prisma.attribute.findUniqueOrThrow({
      where: { code: 'fabric' },
      select: { id: true, values: { where: { value: 'lawn' }, select: { id: true } } },
    });
    fabric = { id: fabricRow.id, lawn: fabricRow.values[0]?.id ?? '' };
    const sizeRow = await prisma.attribute.findUniqueOrThrow({
      where: { code: 'size' },
      select: { id: true, values: { orderBy: { position: 'asc' }, select: { id: true } } },
    });
    size = { id: sizeRow.id, values: sizeRow.values.map((v) => v.id) };
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('image library', () => {
    it('stores a re-encoded WebP with responsive copies, once per file', async () => {
      const jpeg = await photo(1200, 1600, '#8b1a1a');
      const res = await http()
        .post(api('/admin/media'))
        .set(as('catalog-manager'))
        .field('alt', '  Ruby lawn suit, front  ')
        .attach('file', jpeg, { filename: 'front.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const media = res.body as {
        id: string;
        url: string;
        width: number;
        alt: string;
        mimeType: string;
        variants: { width: number; url: string }[];
      };
      expect(media).toMatchObject({
        width: 1200,
        alt: 'Ruby lawn suit, front',
        mimeType: 'image/webp',
      });
      expect(media.url).toMatch(new RegExp(`/media/${media.id}/full\\.webp$`));
      expect(media.variants.map((v) => v.width)).toEqual([320, 640, 960]);
      const stored = [...storage.publicObjects.keys()].filter((k) => k.includes(media.id));
      expect(stored).toHaveLength(4);
      imageId = media.id;

      const again = await http()
        .post(api('/admin/media'))
        .set(as('catalog-manager'))
        .attach('file', jpeg, { filename: 'copy.jpg', contentType: 'image/jpeg' })
        .expect(200);
      expect((again.body as { id: string }).id).toBe(imageId);
    });

    it('refuses non-images, tiny images and staff without the permission', async () => {
      await http()
        .post(api('/admin/media'))
        .set(as('catalog-manager'))
        .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(415);
      const tiny = await http()
        .post(api('/admin/media'))
        .set(as('catalog-manager'))
        .attach('file', await photo(32, 32, '#000'), { filename: 't.jpg' })
        .expect(422);
      expect((tiny.body as { code: string }).code).toBe('IMAGE_REJECTED');
      await http()
        .post(api('/admin/media'))
        .set(as('order-manager'))
        .attach('file', await photo(200, 200, '#fff'), { filename: 'o.jpg' })
        .expect(403);
    });

    it('edits alt text', async () => {
      const res = await http()
        .patch(api(`/admin/media/${imageId}`))
        .set(as('catalog-manager'))
        .send({ alt: null })
        .expect(200);
      expect((res.body as { alt: string | null }).alt).toBeNull();
    });
  });

  describe('products', () => {
    it('creates a live product with variants, attributes, tags and gallery', async () => {
      const res = await http()
        .post(api('/admin/products'))
        .set(as('catalog-manager'))
        .send({
          name: 'E2E Cat Ruby Lawn Suit',
          status: 'ACTIVE',
          primaryCategoryId: categoryId,
          tags: ['E2E Cat Eid', 'e2e cat eid', 'E2E Cat Lawn'],
          attributes: [{ attributeId: fabric.id, valueIds: [fabric.lawn] }],
          specifications: [{ label: 'Pieces', value: '3' }],
          media: [{ mediaId: imageId, variantSku: 'E2E-CAT-001-M' }],
          variants: [
            variant('e2e-cat-001-s', size.values[0] ?? ''),
            variant('E2E-CAT-001-M', size.values[1] ?? '', 0),
          ],
        })
        .expect(201);
      product = res.body as Product;
      expect(product.slug).toBe('e2e-cat-ruby-lawn-suit');
      expect(product.status).toBe('ACTIVE');
      expect(product.tags.map((t) => t.slug)).toEqual(['e2e-cat-eid', 'e2e-cat-lawn']);
      expect(product.attributes).toEqual([{ attributeId: fabric.id, valueIds: [fabric.lawn] }]);
      expect(product.media).toEqual([
        expect.objectContaining({ mediaId: imageId, variantSku: 'E2E-CAT-001-M' }),
      ]);
      expect(product.variants.map((v) => [v.sku, v.inventory?.onHand])).toEqual([
        ['E2E-CAT-001-S', 5],
        ['E2E-CAT-001-M', 0],
      ]);

      const movements = await prisma.inventoryMovement.findMany({
        where: { variant: { productId: product.id } },
      });
      expect(movements).toEqual([
        expect.objectContaining({ delta: 5, reason: 'RESTOCK', note: 'Initial stock' }),
      ]);

      // A second product with the same name gets the next free slug.
      const twin = await http()
        .post(api('/admin/products'))
        .set(as('catalog-manager'))
        .send({
          name: 'E2E Cat Ruby Lawn Suit',
          primaryCategoryId: categoryId,
          variants: [{ sku: 'E2E-CAT-002', priceMinor: 100_000 }],
        })
        .expect(201);
      expect((twin.body as Product).slug).toBe('e2e-cat-ruby-lawn-suit-2');
      expect((twin.body as Product).status).toBe('DRAFT');
    });

    it('shows changes on the storefront immediately', async () => {
      const path = api(`/catalog/products/${product.slug}`);
      const first = await http().get(path).expect(200);
      expect((first.body as { priceMinor: number }).priceMinor).toBe(450_000);

      const s = product.variants[0];
      const res = await http()
        .patch(api(`/admin/products/${product.id}/variants/${s?.id ?? ''}`))
        .set(as('catalog-manager'))
        .send({ priceMinor: 399_000 })
        .expect(200);
      product = res.body as Product;
      const second = await http().get(path).expect(200);
      expect((second.body as { priceMinor: number }).priceMinor).toBe(399_000);
    });

    it('points validation errors at the right field', async () => {
      const base = { name: 'E2E Cat Invalid', primaryCategoryId: categoryId };
      const clash = await http()
        .post(api('/admin/products'))
        .set(as('catalog-manager'))
        .send({
          ...base,
          attributes: [{ attributeId: size.id, valueIds: [size.values[0]] }],
          variants: [
            variant('E2E-CAT-X1', size.values[0] ?? ''),
            variant('E2E-CAT-X2', size.values[0] ?? ''),
          ],
        })
        .expect(422);
      expect((clash.body as { errors: { path: string }[] }).errors.map((e) => e.path)).toEqual([
        'attributes.0.attributeId',
        'variants.1.options',
      ]);

      const taken = await http()
        .post(api('/admin/products'))
        .set(as('catalog-manager'))
        .send({ ...base, variants: [{ sku: 'E2E-CAT-001-S', priceMinor: 1 }] })
        .expect(409);
      expect((taken.body as { code: string }).code).toBe('SKU_TAKEN');

      await http()
        .post(api('/admin/products'))
        .set(as('content-editor'))
        .send({ ...base, variants: [{ sku: 'E2E-CAT-X3', priceMinor: 1 }] })
        .expect(403);
    });

    it('refuses to overwrite someone else’s newer save', async () => {
      const stale = '2020-01-01T00:00:00.000Z';
      const conflict = await http()
        .patch(api(`/admin/products/${product.id}`))
        .set(as('catalog-manager'))
        .send({ name: 'E2E Cat Overwrite', updatedAt: stale })
        .expect(409);
      expect((conflict.body as { code: string }).code).toBe('STALE_UPDATE');

      const res = await http()
        .patch(api(`/admin/products/${product.id}`))
        .set(as('catalog-manager'))
        .send({
          name: 'E2E Cat Ruby Lawn Suit (Eid)',
          shortDescription: 'Three-piece embroidered lawn.',
          tags: ['E2E Cat Eid'],
          updatedAt: product.updatedAt,
        })
        .expect(200);
      const updated = res.body as Product & { name: string };
      expect(updated.name).toBe('E2E Cat Ruby Lawn Suit (Eid)');
      expect(updated.tags.map((t) => t.slug)).toEqual(['e2e-cat-eid']);
      expect(updated.slug).toBe(product.slug); // URLs do not change with the name
      product = updated;

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: product.id, action: 'product.update' },
        orderBy: { id: 'desc' },
      });
      expect(audit?.changes).toMatchObject({
        before: { name: 'E2E Cat Ruby Lawn Suit' },
        after: { name: 'E2E Cat Ruby Lawn Suit (Eid)' },
        replaced: ['tags'],
      });
    });

    it('keeps images in use, and variants consistent', async () => {
      const inUse = await http()
        .delete(api(`/admin/media/${imageId}`))
        .set(as('catalog-manager'))
        .expect(409);
      expect((inUse.body as { code: string; usage: { products: number } }).usage.products).toBe(1);

      const dup = await http()
        .post(api(`/admin/products/${product.id}/variants`))
        .set(as('catalog-manager'))
        .send(variant('E2E-CAT-001-M2', size.values[1] ?? ''))
        .expect(422);
      expect((dup.body as { errors: { path: string }[] }).errors[0]?.path).toBe('options');

      const added = await http()
        .post(api(`/admin/products/${product.id}/variants`))
        .set(as('catalog-manager'))
        .send(variant('E2E-CAT-001-L', size.values[2] ?? '', 2))
        .expect(201);
      const large = (added.body as Product).variants.find((v) => v.sku === 'E2E-CAT-001-L');
      expect(large?.options[0]?.attribute).toBe('Size');

      const removed = await http()
        .delete(api(`/admin/products/${product.id}/variants/${large?.id ?? ''}`))
        .set(as('catalog-manager'))
        .expect(200);
      product = removed.body as Product;
      expect(product.variants).toHaveLength(2);
    });
  });

  describe('inventory', () => {
    it('adjusts stock with a ledger, all lines or none', async () => {
      const [s, m] = product.variants;
      const res = await http()
        .post(api('/admin/inventory/adjustments'))
        .set(as('catalog-manager'))
        .send({
          reason: 'RESTOCK',
          note: 'Supplier delivery',
          items: [
            { variantId: s?.id, add: 10 },
            { variantId: m?.id, set: 4 },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        changed: [
          { sku: 'E2E-CAT-001-S', onHand: 15, delta: 10 },
          { sku: 'E2E-CAT-001-M', onHand: 4, delta: 4 },
        ],
        unchanged: 0,
      });

      // Open orders hold 3 of M: it can never drop below that. Nothing is applied.
      await prisma.inventoryItem.update({
        where: { variantId: m?.id ?? '' },
        data: { reserved: 3 },
      });
      const refused = await http()
        .post(api('/admin/inventory/adjustments'))
        .set(as('catalog-manager'))
        .send({
          reason: 'DAMAGE',
          items: [
            { variantId: s?.id, add: -1 },
            { variantId: m?.id, set: 2 },
          ],
        })
        .expect(422);
      expect((refused.body as { errors: { path: string }[] }).errors.map((e) => e.path)).toEqual([
        'items.1',
      ]);
      const sNow = await prisma.inventoryItem.findUniqueOrThrow({
        where: { variantId: s?.id ?? '' },
      });
      expect(sNow.onHand).toBe(15);

      const low = await http()
        .get(api('/admin/inventory?stock=low&q=e2e-cat-001'))
        .set(as('catalog-manager'))
        .expect(200);
      expect((low.body as { items: { sku: string; available: number }[] }).items).toEqual([
        expect.objectContaining({ sku: 'E2E-CAT-001-M', available: 1 }),
      ]);

      const one = await http()
        .get(api(`/admin/inventory/${s?.id ?? ''}`))
        .set(as('catalog-manager'))
        .expect(200);
      expect(one.body).toMatchObject({ variantId: s?.id, onHand: 15, trackInventory: true });
      await http()
        .get(api('/admin/inventory/00000000-0000-7000-8000-000000000000'))
        .set(as('catalog-manager'))
        .expect(404);

      const history = await http()
        .get(api(`/admin/inventory/${s?.id ?? ''}/movements`))
        .set(as('catalog-manager'))
        .expect(200);
      expect((history.body as { items: { delta: number; note: string }[] }).items[0]).toMatchObject(
        {
          delta: 10,
          note: 'Supplier delivery',
        },
      );
      await prisma.inventoryItem.update({
        where: { variantId: m?.id ?? '' },
        data: { reserved: 0 },
      });
    });

    it('needs inventory.write to change stock', async () => {
      await http()
        .post(api('/admin/inventory/adjustments'))
        .set(as('content-editor'))
        .send({ reason: 'RESTOCK', items: [{ variantId: product.variants[0]?.id, add: 1 }] })
        .expect(403);
    });
  });

  it('deletes a never-ordered product, then its now-unused image', async () => {
    await http()
      .delete(api(`/admin/products/${product.id}`))
      .set(as('catalog-manager'))
      .expect(204);
    await http()
      .get(api(`/catalog/products/${product.slug}`))
      .expect(404);
    await http()
      .delete(api(`/admin/media/${imageId}`))
      .set(as('catalog-manager'))
      .expect(204);
    expect([...storage.publicObjects.keys()].some((k) => k.includes(imageId))).toBe(false);
  });
});
