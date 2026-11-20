import {
  type AttributeDef,
  checkVariantOptions,
  resolveProductAttributes,
} from './product-validation.js';

const def = (
  id: string,
  type: AttributeDef['type'],
  scope: AttributeDef['scope'],
  values: string[] = [],
): AttributeDef => ({
  id,
  name: id,
  type,
  scope,
  valueIds: new Set(values),
});

const defs = new Map<string, AttributeDef>([
  ['fabric', def('fabric', 'SELECT', 'PRODUCT', ['lawn', 'silk'])],
  ['colour', def('colour', 'MULTI_SELECT', 'PRODUCT', ['red', 'gold'])],
  ['pieces', def('pieces', 'NUMBER', 'PRODUCT')],
  ['lined', def('lined', 'BOOLEAN', 'PRODUCT')],
  ['size', def('size', 'SELECT', 'VARIANT', ['s', 'm'])],
  ['shade', def('shade', 'SELECT', 'VARIANT', ['ruby'])],
]);

describe('resolveProductAttributes', () => {
  it('turns inputs into one row per value', () => {
    const { rows, errors } = resolveProductAttributes(
      [
        { attributeId: 'fabric', valueIds: ['lawn'] },
        { attributeId: 'colour', valueIds: ['red', 'gold', 'red'] },
        { attributeId: 'pieces', number: 3 },
        { attributeId: 'lined', boolean: false },
      ],
      defs,
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.valueId ?? r.numberValue ?? r.booleanValue)).toEqual([
      'lawn',
      'red',
      'gold',
      3,
      false,
    ]);
  });

  it('points at the field that is wrong', () => {
    const { errors } = resolveProductAttributes(
      [
        { attributeId: 'fabric', valueIds: ['lawn', 'silk'] },
        { attributeId: 'colour', valueIds: ['blue'] },
        { attributeId: 'size', valueIds: ['s'] },
        { attributeId: 'pieces' },
        { attributeId: 'nope', valueIds: [] },
      ],
      defs,
    );
    expect(errors.map((e) => e.path)).toEqual([
      'attributes.0.valueIds',
      'attributes.1.valueIds',
      'attributes.2.attributeId',
      'attributes.3.number',
      'attributes.4.attributeId',
    ]);
  });
});

describe('checkVariantOptions', () => {
  const v = (i: number, ...options: [string, string][]) => ({
    path: `variants.${String(i)}`,
    sku: `SKU-${String(i)}`,
    options: options.map(([attributeId, valueId]) => ({ attributeId, valueId })),
  });

  it('accepts a single plain variant, or variants told apart by the same options', () => {
    expect(checkVariantOptions([v(0)], defs)).toEqual([]);
    expect(checkVariantOptions([v(0, ['size', 's']), v(1, ['size', 'm'])], defs)).toEqual([]);
  });

  it('refuses variants that cannot be told apart', () => {
    expect(checkVariantOptions([v(0), v(1)], defs)).toHaveLength(2);
    const clash = checkVariantOptions([v(0, ['size', 's']), v(1, ['size', 's'])], defs);
    expect(clash).toEqual([{ path: 'variants.1.options', message: 'Same options as SKU-0.' }]);
    const mixed = checkVariantOptions([v(0, ['size', 's']), v(1, ['shade', 'ruby'])], defs);
    expect(mixed[0]?.message).toMatch(/same option attributes/);
  });

  it('only allows variant-scope single-choice values', () => {
    const errors = checkVariantOptions(
      [v(0, ['fabric', 'lawn']), v(1, ['size', 'xl']), v(2, ['size', 's'], ['size', 'm'])],
      defs,
    );
    expect(errors.map((e) => e.path)).toEqual([
      'variants.0.options.0',
      'variants.1.options.0',
      'variants.2.options.1',
    ]);
  });
});
