import { describe, expect, it } from 'vitest';

import { actionLabel, activityHref, changeLines, entityHref, parseActivityQuery } from './labels';

const ID = '01936f3e-7c1a-7d2b-8e4f-123456789abc';

describe('activity labels', () => {
  it('names known and unknown actions', () => {
    expect(actionLabel('order.ship')).toBe('Shipped an order');
    expect(actionLabel('staff.login.failed')).toBe('Failed sign-in');
    expect(actionLabel('gift-card.top_up')).toBe('Gift card: top up');
  });

  it('links records that have a page', () => {
    expect(entityHref({ entityType: 'product', entityId: ID, changes: null })).toBe(
      `/products/${ID}`,
    );
    expect(entityHref({ entityType: 'staff', entityId: ID, changes: null })).toBe(`/staff/${ID}`);
    expect(entityHref({ entityType: 'contact_message', entityId: ID, changes: null })).toBe(
      `/inbox/${ID}`,
    );
    expect(
      entityHref({ entityType: 'order', entityId: ID, changes: { number: 'AS-260101-ABCDE' } }),
    ).toBe('/orders/AS-260101-ABCDE');
    expect(entityHref({ entityType: 'order', entityId: ID, changes: {} })).toBeNull();
    expect(entityHref({ entityType: 'setting', entityId: null, changes: null })).toBeNull();
    expect(entityHref({ entityType: 'product', entityId: 'not-an-id', changes: null })).toBeNull();
  });

  it('summarises what changed', () => {
    expect(
      changeLines({
        number: 'AS-1',
        before: { status: 'PENDING', paymentStatus: 'UNPAID' },
        after: { status: 'CONFIRMED', paymentStatus: 'UNPAID' },
      }),
    ).toEqual(['status: PENDING → CONFIRMED', 'number: AS-1']);
    expect(changeLines({ reason: 'Spam', roleIds: ['a', 'b'] })).toEqual([
      'reason: Spam',
      'roleIds: 2 items',
    ]);
    expect(changeLines({ before: { note: null }, after: { note: 'x'.repeat(80) } })[0]).toMatch(
      /^note: — → x{57}…$/,
    );
    expect(changeLines(null)).toEqual([]);
  });

  it('reads and writes the URL', () => {
    const query = parseActivityQuery({ area: 'contact_message', actor: 'nope', before: ID });
    expect(query).toEqual({ area: 'contact_message', before: ID });
    expect(activityHref(query, { before: undefined })).toBe('/activity?area=contact_message');
  });
});
