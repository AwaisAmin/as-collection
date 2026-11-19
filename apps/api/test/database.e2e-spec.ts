import type { NestNodeApplication } from '@nestjs/platform-node';

import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';

/** The real database, migrated and seeded (`pnpm db:deploy && pnpm db:seed`). */
describe('database (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('has every migration applied', async () => {
    const [{ pending }] = await prisma.$queryRaw<[{ pending: bigint }]>`
      SELECT count(*) AS pending FROM _prisma_migrations WHERE finished_at IS NULL`;
    expect(pending).toBe(0n);
  });

  it('stores money as integer minor units with consistent stock', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({
      include: { inventory: true },
      orderBy: { sku: 'asc' },
    });
    expect(Number.isInteger(variant.priceMinor)).toBe(true);
    expect(variant.inventory?.onHand).toBeGreaterThanOrEqual(0);
  });

  it('enforces CHECK constraints in the database itself', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow();
    await expect(
      prisma.productVariant.update({ where: { id: variant.id }, data: { priceMinor: -1 } }),
    ).rejects.toThrow(/product_variants_price_check/);
  });

  it('treats emails case-insensitively (citext)', async () => {
    const email = `case-${Date.now()}@example.com`;
    const created = await prisma.newsletterSubscriber.create({ data: { email } });
    try {
      const found = await prisma.newsletterSubscriber.findUnique({
        where: { email: email.toUpperCase() },
      });
      expect(found?.id).toBe(created.id);
    } finally {
      await prisma.newsletterSubscriber.delete({ where: { id: created.id } });
    }
  });

  it('ships the seeded catalog with filterable attributes', async () => {
    const lawn = await prisma.product.count({
      where: { attributes: { some: { attribute: { code: 'fabric' }, value: { value: 'lawn' } } } },
    });
    expect(lawn).toBeGreaterThan(0);
  });
});
