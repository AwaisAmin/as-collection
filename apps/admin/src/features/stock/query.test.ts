import { describe, expect, it } from 'vitest';

import { parseStockQuery, stockListHref, toStockApiQuery } from './query';

describe('stock list query', () => {
  it('reads valid state and drops what is invalid', () => {
    expect(parseStockQuery({ view: 'low', q: ' mkup ', page: '2' })).toEqual({
      view: 'low',
      q: 'mkup',
      page: 2,
    });
    expect(parseStockQuery({ view: 'everything', page: 'x' })).toEqual({ view: 'all', page: 1 });
  });

  it('maps to the API and back to links', () => {
    const query = parseStockQuery({ view: 'out', q: 'Lawn', page: '3' });
    expect(toStockApiQuery(query)).toEqual({ stock: 'out', q: 'Lawn', page: 3, pageSize: 50 });
    expect(stockListHref(query, { view: 'low' })).toBe('/stock?view=low&q=Lawn');
    expect(stockListHref(query, { page: 4 })).toBe('/stock?view=out&q=Lawn&page=4');
    expect(stockListHref({ view: 'all', page: 1 }, {})).toBe('/stock');
  });
});
