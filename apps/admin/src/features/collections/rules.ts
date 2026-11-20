import type { CollectionRuleDto, CollectionRulesDto } from '@as/contracts';

import { rupeesToMinor } from '@/features/products/form-model';

/*
 * Automated collection rules as the form edits them (one row per condition) and as the API
 * stores them. Tags and attribute values are matched by their slugs.
 */

export type RuleKind =
  'onSale' | 'inStock' | 'featured' | 'tag' | 'attribute' | 'priceMax' | 'priceMin' | 'newWithin';

export const RULE_KINDS: Record<RuleKind, string> = {
  onSale: 'On sale',
  inStock: 'In stock',
  featured: 'Featured',
  tag: 'Has tag',
  attribute: 'Detail is',
  priceMax: 'Price at most',
  priceMin: 'Price at least',
  newWithin: 'Added in the last',
};

export interface DraftRule {
  key: string;
  kind: RuleKind;
  /** onSale / inStock / featured */
  yes: boolean;
  /** tag: comma-separated tag names or slugs */
  tags: string;
  /** attribute: its code, and the chosen value slugs */
  code: string;
  values: string[];
  /** priceMax / priceMin, in rupees */
  rupees: string;
  /** newWithin */
  days: string;
}

export interface DraftRules {
  match: 'all' | 'any';
  rules: DraftRule[];
}

let counter = 0;
const key = () => `r${String(++counter)}`;

export const emptyRule = (kind: RuleKind = 'tag'): DraftRule => ({
  key: key(),
  kind,
  yes: true,
  tags: '',
  code: '',
  values: [],
  rupees: '',
  days: '30',
});

/** "Eid Special" → "eid-special" (the API's slug rule). */
export const slugify = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const tagSlugs = (text: string) => [
  ...new Set(
    text
      .split(',')
      .map((t) => slugify(t))
      .filter(Boolean),
  ),
];

const rupeesOf = (minor: number) => (minor % 100 ? (minor / 100).toFixed(2) : String(minor / 100));

export function draftFromRules(rules: CollectionRulesDto | null): DraftRules {
  if (!rules) return { match: 'all', rules: [emptyRule()] };
  const match = 'all' in rules ? 'all' : 'any';
  const list = 'all' in rules ? rules.all : rules.any;
  return {
    match,
    rules: list.map((rule): DraftRule => {
      const base = emptyRule();
      switch (rule.field) {
        case 'onSale':
        case 'inStock':
        case 'featured':
          return { ...base, kind: rule.field, yes: rule.value };
        case 'tag':
          return { ...base, kind: 'tag', tags: rule.value.join(', ') };
        case 'attribute':
          return { ...base, kind: 'attribute', code: rule.code, values: rule.value };
        case 'priceMinor':
          return {
            ...base,
            kind: rule.op === 'lte' ? 'priceMax' : 'priceMin',
            rupees: rupeesOf(rule.value),
          };
        case 'publishedWithinDays':
          return { ...base, kind: 'newWithin', days: String(rule.value) };
      }
    }),
  };
}

/** One row as an API rule, or a message saying what is missing. */
export function toRule(rule: DraftRule): CollectionRuleDto | string {
  switch (rule.kind) {
    case 'onSale':
    case 'inStock':
    case 'featured':
      return { field: rule.kind, op: 'eq', value: rule.yes };
    case 'tag': {
      const value = tagSlugs(rule.tags);
      return value.length ? { field: 'tag', op: 'in', value } : 'Enter at least one tag.';
    }
    case 'attribute':
      if (!rule.code) return 'Choose a detail.';
      return rule.values.length
        ? { field: 'attribute', op: 'in', code: rule.code, value: rule.values }
        : 'Choose at least one value.';
    case 'priceMax':
    case 'priceMin': {
      const minor = rupeesToMinor(rule.rupees);
      if (minor === null || Number.isNaN(minor)) return 'Enter a price in rupees.';
      return { field: 'priceMinor', op: rule.kind === 'priceMax' ? 'lte' : 'gte', value: minor };
    }
    case 'newWithin': {
      const days = Number(rule.days);
      return Number.isInteger(days) && days > 0 && days <= 3650
        ? { field: 'publishedWithinDays', op: 'lte', value: days }
        : 'Enter a number of days.';
    }
  }
}

/** The rules for the API, plus a message per incomplete row (by its key). */
export function rulesPayload(draft: DraftRules): {
  rules: CollectionRulesDto | null;
  problems: Record<string, string>;
} {
  const problems: Record<string, string> = {};
  const list: CollectionRuleDto[] = [];
  for (const row of draft.rules) {
    const rule = toRule(row);
    if (typeof rule === 'string') problems[row.key] = rule;
    else list.push(rule);
  }
  if (!list.length) return { rules: null, problems };
  return { rules: draft.match === 'all' ? { all: list } : { any: list }, problems };
}
