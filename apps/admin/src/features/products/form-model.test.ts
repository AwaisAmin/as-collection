import { describe, expect, it } from 'vitest';

import {
  createPayload,
  emptyDraft,
  minorToRupees,
  rupeesToMinor,
  updatePayload,
} from './form-model';

describe('rupee amounts', () => {
  it('reads what staff type', () => {
    expect(rupeesToMinor('2490')).toBe(249_000);
    expect(rupeesToMinor('1,250.5')).toBe(125_050);
    expect(rupeesToMinor(' Rs 99.05 ')).toBe(9_905);
    expect(rupeesToMinor('')).toBeNull();
    expect(rupeesToMinor('12.345')).toBeNaN();
    expect(rupeesToMinor('-5')).toBeNaN();
  });

  it('writes paisa back as rupees', () => {
    expect(minorToRupees(249_000)).toBe('2490');
    expect(minorToRupees(125_050)).toBe('1250.50');
    expect(minorToRupees(null)).toBe('');
  });
});

describe('product payloads', () => {
  const draft = {
    ...emptyDraft(),
    name: '  Silk Dupatta ',
    primaryCategoryId: 'cat-1',
    categoryIds: ['cat-1', 'cat-2'],
    tags: 'silk, Eid , silk,',
    specifications: [
      { key: 'a', label: 'Fabric', value: 'Silk' },
      { key: 'b', label: '', value: '' },
    ],
    attributes: {
      colour: { attributeId: 'colour', valueIds: ['red'] },
      empty: { attributeId: 'empty', valueIds: [] },
      note: { attributeId: 'note', text: '  ' },
    },
    optionAttributeIds: ['size'],
  };

  it('builds a create body with variants in paisa and initial stock', () => {
    const body = createPayload({
      ...draft,
      variants: [
        {
          key: 'v',
          sku: ' dup-01 ',
          title: '',
          price: '4,500',
          compareAt: '',
          cost: 'abc',
          stock: '12',
          trackInventory: true,
          allowBackorder: false,
          options: { size: 'm', other: 'x' },
        },
      ],
    });
    expect(body).toMatchObject({
      name: 'Silk Dupatta',
      categoryIds: ['cat-2'],
      brandId: null,
      tags: ['silk', 'Eid'],
      specifications: [{ label: 'Fabric', value: 'Silk' }],
      attributes: [{ attributeId: 'colour', valueIds: ['red'] }],
      variants: [
        {
          sku: 'dup-01',
          title: null,
          priceMinor: 450_000,
          compareAtPriceMinor: null,
          costMinor: -1,
          options: [{ attributeId: 'size', valueId: 'm' }],
          inventory: { onHand: 12, trackInventory: true, allowBackorder: false },
        },
      ],
    });
    expect(body).not.toHaveProperty('slug');
  });

  it('sends the version it edited on update', () => {
    const body = updatePayload({ ...draft, slug: 'silk-dupatta' }, '2026-11-20T10:00:00.000Z');
    expect(body).toMatchObject({ slug: 'silk-dupatta', updatedAt: '2026-11-20T10:00:00.000Z' });
    expect(body).not.toHaveProperty('variants');
  });
});
