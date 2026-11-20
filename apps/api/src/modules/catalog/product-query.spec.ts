import type { Prisma } from '../../generated/prisma/client.js';
import { listProductsQuerySchema } from './catalog.schemas.js';
import {
  collectionRulesSchema,
  productOrderBy,
  type ProductQueryContext,
  productWhere,
  rulesWhere,
  searchWhere,
} from './product-query.js';

const now = new Date('2026-11-19T12:00:00Z');
const reservedField = { name: 'reserved' } as unknown as Prisma.IntFieldRefInput<'InventoryItem'>;
const ctx = (overrides: Partial<ProductQueryContext> = {}): ProductQueryContext => ({
  attributes: new Map([
    ['fabric', { id: 'attr-fabric', scope: 'PRODUCT' }],
    ['size', { id: 'attr-size', scope: 'VARIANT' }],
  ]),
  collections: [],
  reservedField,
  now,
  ...overrides,
});
const parse = (params: Record<string, string>) => listProductsQuerySchema.parse(params);
const and = (where: Prisma.ProductWhereInput) => where.AND as Prisma.ProductWhereInput[];

describe('listProductsQuerySchema', () => {
  it('applies defaults', () => {
    expect(parse({})).toMatchObject({
      sort: 'featured',
      page: 1,
      pageSize: 12,
      collections: [],
      tags: [],
      attributes: {},
      inStock: false,
      sale: false,
    });
  });

  it('collects f.<code> attribute filters, deduplicated and sorted', () => {
    const q = parse({ 'f.fabric': 'lawn,chiffon,lawn', 'f.size': 'm', utm_source: 'x' });
    expect(q.attributes).toEqual({ fabric: ['chiffon', 'lawn'], size: ['m'] });
  });

  it('rejects invalid values instead of guessing', () => {
    expect(() => parse({ sort: 'cheapest' })).toThrow();
    expect(() => parse({ pageSize: '500' })).toThrow();
    expect(() => parse({ 'f.fabric': 'Lawn Fabric!' })).toThrow();
    expect(() => parse({ min: '500', max: '100' })).toThrow(/greater than max/);
  });
});

describe('productWhere', () => {
  it('always limits results to active, published products', () => {
    const where = productWhere(parse({}), ctx());
    expect(and(where)[0]).toEqual({ status: 'ACTIVE', publishedAt: { lte: now } });
  });

  it('looks up exact products by id or slug (still only visible ones)', () => {
    const id = '01890000-0000-7000-8000-000000000000';
    const where = productWhere(parse({ ids: `${id},${id}`, slugs: 'ruby-lawn' }), ctx());
    expect(and(where)).toEqual([
      { status: 'ACTIVE', publishedAt: { lte: now } },
      { id: { in: [id] } },
      { slug: { in: ['ruby-lawn'] } },
    ]);
    expect(listProductsQuerySchema.safeParse({ ids: 'not-a-uuid' }).success).toBe(false);
  });

  it('filters product attributes by value and variant options by available stock', () => {
    const where = productWhere(
      parse({ 'f.fabric': 'lawn', 'f.size': 'm', 'f.unknown': 'x' }),
      ctx(),
    );
    const conditions = and(where);
    expect(conditions).toContainEqual({
      attributes: { some: { attributeId: 'attr-fabric', value: { value: { in: ['lawn'] } } } },
    });
    const variantFilter = conditions.find((c) => 'variants' in c);
    expect(JSON.stringify(variantFilter)).toContain('attr-size');
    expect(JSON.stringify(variantFilter)).toContain('"isActive":true');
    expect(conditions).toHaveLength(3); // visible + fabric + size; unknown code ignored
  });

  it('includes the category subtree through primary and extra categories', () => {
    const where = productWhere(parse({}), ctx({ categoryPath: '/root/' }));
    expect(and(where)).toContainEqual({
      OR: [
        { primaryCategory: { path: { startsWith: '/root/' } } },
        { categories: { some: { category: { path: { startsWith: '/root/' } } } } },
      ],
    });
  });

  it('uses the trigger-maintained summary columns for price, stock and sale', () => {
    const conditions = and(
      productWhere(parse({ min: '100000', max: '500000', inStock: '1', sale: 'true' }), ctx()),
    );
    expect(conditions).toEqual(
      expect.arrayContaining([
        { priceMinMinor: { gte: 100000 } },
        { priceMinMinor: { lte: 500000 } },
        { inStock: true },
        { isOnSale: true },
      ]),
    );
  });

  it('matches manual collections by membership and automated ones by rules', () => {
    const where = productWhere(
      parse({}),
      ctx({
        collections: [
          { type: 'MANUAL', id: 'col-1' },
          { type: 'AUTOMATED', rules: { all: [{ field: 'onSale', op: 'eq', value: true }] } },
        ],
      }),
    );
    expect(and(where)).toContainEqual({
      OR: [{ collections: { some: { collectionId: 'col-1' } } }, { AND: [{ isOnSale: true }] }],
    });
  });
});

describe('searchWhere', () => {
  it('requires every word and strips LIKE wildcards', () => {
    const clauses = searchWhere('Black  50%_chiffon');
    expect(clauses).toHaveLength(2);
    expect(JSON.stringify(clauses)).not.toMatch(/[%_]/);
    expect(JSON.stringify(clauses[0])).toContain('"contains":"black"');
  });
});

describe('collection rules', () => {
  it('validates stored rules and builds AND / OR conditions', () => {
    const rules = collectionRulesSchema.parse({
      any: [
        { field: 'tag', op: 'in', value: ['eid'] },
        { field: 'publishedWithinDays', op: 'lte', value: 30 },
      ],
    });
    const where = rulesWhere(rules, { now });
    expect(where.OR).toHaveLength(2);
    expect(() => collectionRulesSchema.parse({ all: [{ field: 'sql', op: 'raw' }] })).toThrow();
  });
});

describe('productOrderBy', () => {
  it('always ends with a unique tie-breaker so pagination is stable', () => {
    for (const sort of ['featured', 'newest', 'price-asc', 'price-desc', 'rating'] as const) {
      expect(productOrderBy(sort).at(-1)).toEqual({ id: 'desc' });
    }
  });

  it('sorts price with products without a price last', () => {
    expect(productOrderBy('price-asc')[0]).toEqual({
      priceMinMinor: { sort: 'asc', nulls: 'last' },
    });
  });
});
