import type { AdminCategoryNodeDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import { flattenCategories, parseProductQuery, productListHref, toProductApiQuery } from './query';

const node = (id: string, depth: number, children: AdminCategoryNodeDto[] = []) =>
  ({
    id,
    name: id.toUpperCase(),
    depth,
    isActive: true,
    children,
  }) as unknown as AdminCategoryNodeDto;

describe('product list query', () => {
  it('reads valid state and drops what is invalid', () => {
    expect(
      parseProductQuery({ status: 'DRAFT', q: ' lawn ', category: 'nope', low: '1', sort: 'x' }),
    ).toEqual({ tab: 'DRAFT', q: 'lawn', low: true, sort: 'updated', page: 1 });
  });

  it('maps to the API and back to links', () => {
    const query = parseProductQuery({ status: 'ACTIVE', sort: 'name', page: '3' });
    expect(toProductApiQuery(query)).toMatchObject({ status: 'ACTIVE', sort: 'name', page: 3 });
    expect(toProductApiQuery({ ...query, tab: 'all' }).status).toBeUndefined();
    expect(productListHref(query, { low: true })).toBe('/products?status=ACTIVE&low=1&sort=name');
    expect(productListHref(query, { page: 4 })).toBe('/products?status=ACTIVE&sort=name&page=4');
  });

  it('flattens the category tree with indentation', () => {
    const tree = [node('women', 0, [node('lawn', 1, [node('printed', 2)])]), node('beauty', 0)];
    expect(flattenCategories(tree).map((c) => c.label)).toEqual([
      'WOMEN',
      '— LAWN',
      '— — PRINTED',
      'BEAUTY',
    ]);
  });
});
