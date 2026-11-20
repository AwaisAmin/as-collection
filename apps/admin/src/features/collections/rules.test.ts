import { describe, expect, it } from 'vitest';

import { draftFromRules, emptyRule, rulesPayload, toRule } from './rules';

describe('collection rules', () => {
  it('turns rows into API rules', () => {
    expect(toRule({ ...emptyRule('onSale'), yes: true })).toEqual({
      field: 'onSale',
      op: 'eq',
      value: true,
    });
    expect(toRule({ ...emptyRule('tag'), tags: 'Eid Special, eid-special, Wedding' })).toEqual({
      field: 'tag',
      op: 'in',
      value: ['eid-special', 'wedding'],
    });
    expect(toRule({ ...emptyRule('priceMax'), rupees: '4,999' })).toEqual({
      field: 'priceMinor',
      op: 'lte',
      value: 499_900,
    });
    expect(toRule({ ...emptyRule('newWithin'), days: '14' })).toEqual({
      field: 'publishedWithinDays',
      op: 'lte',
      value: 14,
    });
  });

  it('says what an incomplete row is missing', () => {
    expect(toRule({ ...emptyRule('tag'), tags: ' , ' })).toBe('Enter at least one tag.');
    expect(toRule({ ...emptyRule('attribute'), code: 'fabric' })).toBe(
      'Choose at least one value.',
    );
    expect(toRule({ ...emptyRule('priceMin'), rupees: 'cheap' })).toBe('Enter a price in rupees.');
  });

  it('round-trips stored rules', () => {
    const stored = {
      any: [
        { field: 'attribute', op: 'in', code: 'fabric', value: ['lawn'] },
        { field: 'priceMinor', op: 'gte', value: 125_050 },
        { field: 'inStock', op: 'eq', value: false },
      ],
    } as const;
    const draft = draftFromRules(structuredClone(stored) as never);
    expect(draft.match).toBe('any');
    expect(draft.rules[1]?.rupees).toBe('1250.50');
    expect(rulesPayload(draft)).toEqual({ rules: stored, problems: {} });
  });

  it('reports problems by row and leaves them out', () => {
    const ok = { ...emptyRule('featured') };
    const bad = { ...emptyRule('tag') };
    const result = rulesPayload({ match: 'all', rules: [ok, bad] });
    expect(result.rules).toEqual({ all: [{ field: 'featured', op: 'eq', value: true }] });
    expect(result.problems).toEqual({ [bad.key]: 'Enter at least one tag.' });
  });
});
