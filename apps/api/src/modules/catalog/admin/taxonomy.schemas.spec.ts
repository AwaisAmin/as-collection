import { collectionState } from './admin-collections.service.js';
import { sameMembers } from './admin-write.js';
import {
  adminCollectionRulesSchema,
  createAttributeSchema,
  createCategorySchema,
  createCollectionSchema,
} from './taxonomy.schemas.js';

const id = '01890000-0000-7000-8000-000000000000';

describe('taxonomy schemas', () => {
  it('validates category banners (focus is a CSS position)', () => {
    const ok = createCategorySchema.parse({
      name: '  Luxury  Pret ',
      banner: { eyebrow: 'New season', focus: '50% 30%' },
    });
    expect(ok).toMatchObject({ name: 'Luxury Pret', parentId: null, isActive: true });
    expect(
      createCategorySchema.safeParse({ name: 'X', banner: { focus: 'center; color: red' } })
        .success,
    ).toBe(false);
    expect(
      createCategorySchema.safeParse({
        name: 'X',
        attributes: [{ attributeId: id }, { attributeId: id }],
      }).success,
    ).toBe(false);
  });

  it('keeps variant options single-choice and value lists for choice types only', () => {
    const shade = createAttributeSchema.parse({
      name: 'Shade',
      type: 'SELECT',
      scope: 'VARIANT',
      values: [{ label: 'Ruby', swatch: '#9B1B30' }],
    });
    expect(shade.values[0]?.swatch).toBe('#9b1b30');
    expect(
      createAttributeSchema.safeParse({ name: 'Colours', type: 'MULTI_SELECT', scope: 'VARIANT' })
        .success,
    ).toBe(false);
    expect(
      createAttributeSchema.safeParse({ name: 'Weight', type: 'NUMBER', values: [{ label: 'x' }] })
        .success,
    ).toBe(false);
    expect(
      createAttributeSchema.safeParse({
        name: 'Shade',
        type: 'SELECT',
        values: [{ label: 'Ruby', swatch: 'red' }],
      }).success,
    ).toBe(false);
  });

  it('checks collection rules and windows', () => {
    expect(
      adminCollectionRulesSchema.safeParse({
        any: [{ field: 'tag', op: 'in', value: ['Eid Edit'] }],
      }).success,
    ).toBe(false);
    expect(createCollectionSchema.safeParse({ name: 'Eid', type: 'AUTOMATED' }).success).toBe(
      false,
    );
    expect(
      createCollectionSchema.safeParse({
        name: 'Eid',
        startsAt: '2026-12-01T00:00:00+05:00',
        endsAt: '2026-11-01T00:00:00+05:00',
      }).success,
    ).toBe(false);
    const sale = createCollectionSchema.parse({
      name: 'Sale',
      type: 'AUTOMATED',
      rules: { all: [{ field: 'onSale', op: 'eq', value: true }] },
    });
    expect(sale.rules).toEqual({ all: [{ field: 'onSale', op: 'eq', value: true }] });
  });
});

describe('collectionState', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const at = (iso: string) => new Date(iso);

  it('mirrors what the storefront shows', () => {
    const base = { isActive: true, startsAt: null, endsAt: null };
    expect(collectionState(base, now)).toBe('live');
    expect(collectionState({ ...base, isActive: false }, now)).toBe('hidden');
    expect(collectionState({ ...base, startsAt: at('2026-12-01T00:00:00Z') }, now)).toBe(
      'scheduled',
    );
    expect(collectionState({ ...base, endsAt: now }, now)).toBe('ended');
  });
});

describe('sameMembers', () => {
  it('requires exactly the same ids, each once', () => {
    expect(sameMembers(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(sameMembers(['a', 'a'], ['a', 'b'])).toBe(false);
    expect(sameMembers(['a'], ['a', 'b'])).toBe(false);
  });
});
