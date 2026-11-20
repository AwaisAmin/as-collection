import { createDiscountSchema } from './admin-discounts.schemas.js';
import { discountState } from './admin-discounts.service.js';

const now = new Date('2026-11-20T12:00:00Z');
const base = {
  id: 'd',
  code: 'EID15',
  description: null,
  type: 'PERCENTAGE' as const,
  value: 1500,
  minSubtotalMinor: null,
  maxDiscountMinor: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usageCount: 0,
  perCustomerLimit: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

describe('discount codes', () => {
  it('normalises codes and checks values per type', () => {
    expect(
      createDiscountSchema.parse({ code: ' eid15 ', type: 'PERCENTAGE', value: 1500 }).code,
    ).toBe('EID15');
    expect(
      createDiscountSchema.safeParse({ code: 'EID', type: 'PERCENTAGE', value: 15_000 }).success,
    ).toBe(false);
    expect(
      createDiscountSchema.safeParse({ code: 'SHIP', type: 'FREE_SHIPPING', value: 100 }).success,
    ).toBe(false);
    expect(
      createDiscountSchema.safeParse({
        code: 'RS500',
        type: 'FIXED_AMOUNT',
        value: 50_000,
        maxDiscountMinor: 1,
      }).success,
    ).toBe(false);
    expect(createDiscountSchema.safeParse({ code: 'a b', type: 'FREE_SHIPPING' }).success).toBe(
      false,
    );
  });

  it('reports the state checkout would see', () => {
    expect(discountState(base, now)).toBe('active');
    expect(discountState({ ...base, isActive: false }, now)).toBe('inactive');
    expect(discountState({ ...base, endsAt: now }, now)).toBe('expired');
    expect(discountState({ ...base, usageLimit: 5, usageCount: 5 }, now)).toBe('used-up');
    expect(discountState({ ...base, startsAt: new Date('2026-12-01T00:00:00Z') }, now)).toBe(
      'scheduled',
    );
  });
});
