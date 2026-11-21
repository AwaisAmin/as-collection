import { describe, expect, it } from 'vitest';

import { ADDABLE_TYPES, sectionState, sectionSummary } from './sections';

const now = new Date('2026-11-21T10:00:00Z');
const base = { valid: true, isVisible: true, startsAt: null, endsAt: null };

describe('home page sections', () => {
  it('works out whether a section is showing', () => {
    expect(sectionState(base, now)).toBe('live');
    expect(sectionState({ ...base, isVisible: false }, now)).toBe('hidden');
    expect(sectionState({ ...base, startsAt: '2026-11-22T00:00:00Z' }, now)).toBe('scheduled');
    expect(sectionState({ ...base, endsAt: '2026-11-21T09:00:00Z' }, now)).toBe('ended');
    expect(sectionState({ ...base, valid: false, isVisible: false }, now)).toBe('invalid');
  });

  it('describes sections with the shop’s names', () => {
    const names = {
      categories: new Map([['makeup', 'Makeup']]),
      collections: new Map([['eid', 'Eid']]),
    };
    expect(
      sectionSummary(
        {
          type: 'product-carousel',
          settings: { title: 'Eid picks', source: { kind: 'collection', slug: 'eid' }, limit: 8 },
        },
        names,
      ),
    ).toBe('Eid picks · Eid · up to 8');
    expect(
      sectionSummary(
        { type: 'category-grid', settings: { categorySlugs: ['makeup', 'x'] } },
        names,
      ),
    ).toBe('Makeup, x');
    expect(
      sectionSummary(
        { type: 'product-tabs', settings: { title: 'Shop', tabs: [{ categorySlug: 'makeup' }] } },
        names,
      ),
    ).toBe('Shop · tabs: Makeup');
  });

  it('only offers types it can start with sensible settings', () => {
    expect(ADDABLE_TYPES).toContain('product-carousel');
    expect(ADDABLE_TYPES).not.toContain('shop-the-look');
  });
});
