import type { FieldError } from '../../../common/http/problem-details.js';
import type { AttributeScope, AttributeType } from '../../../generated/prisma/enums.js';

/*
 * Rules that need the attribute definitions (loaded from the database), kept pure for testing.
 * Errors use the same `{ path, message }` shape as schema validation, so the admin panel shows
 * them next to the right field.
 */

/** A product-level attribute as entered (see `attributeInputSchema`). */
export interface AttributeInput {
  attributeId: string;
  valueIds?: string[] | undefined;
  text?: string | undefined;
  number?: number | undefined;
  boolean?: boolean | undefined;
}

export interface AttributeDef {
  id: string;
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  valueIds: ReadonlySet<string>;
}

export interface AttributeRow {
  attributeId: string;
  valueId: string | null;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
}

/** Product-level attribute inputs → rows for `product_attribute_values`. */
export function resolveProductAttributes(
  inputs: readonly AttributeInput[],
  defs: ReadonlyMap<string, AttributeDef>,
): { rows: AttributeRow[]; errors: FieldError[] } {
  const rows: AttributeRow[] = [];
  const errors: FieldError[] = [];
  inputs.forEach((input, i) => {
    const at = (field?: string) => `attributes.${String(i)}${field ? `.${field}` : ''}`;
    const def = defs.get(input.attributeId);
    if (!def) {
      errors.push({ path: at('attributeId'), message: 'Unknown attribute.' });
      return;
    }
    if (def.scope !== 'PRODUCT') {
      errors.push({
        path: at('attributeId'),
        message: `${def.name} is chosen per variant; set it on the variants instead.`,
      });
      return;
    }
    const empty = { textValue: null, numberValue: null, booleanValue: null };
    switch (def.type) {
      case 'SELECT':
      case 'MULTI_SELECT': {
        const ids = [...new Set(input.valueIds ?? [])];
        if (ids.length === 0 || (def.type === 'SELECT' && ids.length > 1)) {
          errors.push({
            path: at('valueIds'),
            message:
              def.type === 'SELECT'
                ? `Choose one ${def.name} value.`
                : `Choose at least one ${def.name} value.`,
          });
          return;
        }
        const unknown = ids.find((id) => !def.valueIds.has(id));
        if (unknown) {
          errors.push({ path: at('valueIds'), message: `Not a ${def.name} value.` });
          return;
        }
        for (const valueId of ids) rows.push({ attributeId: def.id, valueId, ...empty });
        return;
      }
      case 'TEXT':
        if (!input.text) {
          errors.push({ path: at('text'), message: `Enter the ${def.name}.` });
          return;
        }
        rows.push({ attributeId: def.id, valueId: null, ...empty, textValue: input.text });
        return;
      case 'NUMBER':
        if (input.number === undefined) {
          errors.push({ path: at('number'), message: `Enter the ${def.name} as a number.` });
          return;
        }
        rows.push({ attributeId: def.id, valueId: null, ...empty, numberValue: input.number });
        return;
      case 'BOOLEAN':
        if (input.boolean === undefined) {
          errors.push({ path: at('boolean'), message: `Choose yes or no for ${def.name}.` });
          return;
        }
        rows.push({ attributeId: def.id, valueId: null, ...empty, booleanValue: input.boolean });
        return;
    }
  });
  return { rows, errors };
}

const under = (path: string, field: string) => (path ? `${path}.${field}` : field);

export interface VariantOptions {
  /** Where errors point, e.g. `variants.2`; '' when the body is the variant itself. */
  path: string;
  sku: string;
  options: readonly { attributeId: string; valueId: string }[];
}

/**
 * A product's variants must be told apart by the same option attributes (all have Size, or all
 * have Size + Colour), each a variant-scope single-choice attribute, with no two variants
 * sharing the same combination. A single variant may have no options.
 */
export function checkVariantOptions(
  variants: readonly VariantOptions[],
  defs: ReadonlyMap<string, AttributeDef>,
): FieldError[] {
  const errors: FieldError[] = [];
  const signature = (v: VariantOptions) =>
    v.options
      .map((o) => o.attributeId)
      .toSorted()
      .join(',');

  for (const variant of variants) {
    const seen = new Set<string>();
    variant.options.forEach((option, i) => {
      const path = under(variant.path, `options.${String(i)}`);
      const def = defs.get(option.attributeId);
      if (!def) {
        errors.push({ path, message: 'Unknown attribute.' });
      } else if (def.scope !== 'VARIANT' || def.type !== 'SELECT') {
        errors.push({ path, message: `${def.name} cannot be used to tell variants apart.` });
      } else if (!def.valueIds.has(option.valueId)) {
        errors.push({ path, message: `Not a ${def.name} value.` });
      }
      if (seen.has(option.attributeId)) {
        errors.push({ path, message: 'Each attribute can be used once per variant.' });
      }
      seen.add(option.attributeId);
    });
  }
  if (errors.length || variants.length < 2) return errors;

  const first = variants[0];
  const expected = first ? signature(first) : '';
  const combinations = new Map<string, string>();
  for (const variant of variants) {
    if (!variant.options.length) {
      errors.push({
        path: under(variant.path, 'options'),
        message: 'With several variants, each needs options (e.g. Size) to tell them apart.',
      });
      continue;
    }
    if (signature(variant) !== expected) {
      errors.push({
        path: under(variant.path, 'options'),
        message: 'All variants must use the same option attributes.',
      });
      continue;
    }
    const combination = variant.options
      .map((o) => `${o.attributeId}=${o.valueId}`)
      .toSorted()
      .join('&');
    const clash = combinations.get(combination);
    if (clash) {
      errors.push({
        path: under(variant.path, 'options'),
        message: `Same options as ${clash}.`,
      });
    }
    combinations.set(combination, variant.sku);
  }
  return errors;
}
