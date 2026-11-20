import { describe, expect, it } from 'vitest';

import { orderListHref, parseOrderQuery, toApiQuery } from './query';

describe('order list query', () => {
  it('reads valid state and drops what is invalid', () => {
    const query = parseOrderQuery({
      view: 'to-ship',
      q: '  0300 1234567 ',
      method: 'BITCOIN',
      from: '2026-11-01',
      to: 'yesterday',
      page: '3',
    });
    expect(query).toEqual({ view: 'to-ship', q: '0300 1234567', from: '2026-11-01', page: 3 });
  });

  it('falls back to the first page of all orders', () => {
    expect(parseOrderQuery({ view: 'nope', page: '-2', q: 'a' })).toEqual({ view: 'all', page: 1 });
    expect(parseOrderQuery({ view: ['payments', 'all'] }).view).toBe('payments');
  });

  it('maps views to API filters', () => {
    expect(toApiQuery({ view: 'to-ship', page: 1 }).status).toEqual(['CONFIRMED', 'PROCESSING']);
    expect(toApiQuery({ view: 'payments', page: 2 })).toMatchObject({
      paymentStatus: ['AWAITING_VERIFICATION'],
      page: 2,
      pageSize: 25,
    });
  });

  it('builds links that reset the page unless one is given', () => {
    const query = parseOrderQuery({ view: 'shipped', q: 'Ayesha', page: '4' });
    expect(orderListHref(query, { view: 'delivered' })).toBe('/orders?view=delivered&q=Ayesha');
    expect(orderListHref(query, { page: 5 })).toBe('/orders?view=shipped&q=Ayesha&page=5');
    expect(orderListHref({ view: 'all', page: 1 }, {})).toBe('/orders');
  });
});
