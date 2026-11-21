import type { AdminSectionDto, SectionSettingsMap, SectionType } from '@as/contracts';

import type { BadgeTone } from '@/components/ui/badge';

/*
 * Home page section types: what staff call them, what they show, and how they're edited.
 * `form`: a settings form; `none`: nothing to set; `advanced`: the full settings as JSON
 * (rich sections whose editors come with images and hotspots).
 */

export interface SectionMeta {
  label: string;
  description: string;
  editor: 'form' | 'none' | 'advanced';
  /** Can be added more than once (carousels, grids…). */
  repeatable: boolean;
}

export const SECTION_TYPES: Record<SectionType, SectionMeta> = {
  hero: {
    label: 'Hero',
    description: 'The large opening banner.',
    editor: 'none',
    repeatable: false,
  },
  'category-grid': {
    label: 'Category tiles',
    description: 'Picture tiles linking to categories.',
    editor: 'form',
    repeatable: true,
  },
  'trust-bar': {
    label: 'Trust bar',
    description: 'Delivery, returns and support promises (edited in Settings).',
    editor: 'none',
    repeatable: false,
  },
  'product-carousel': {
    label: 'Product carousel',
    description: 'A row of products: newest, bestsellers, on sale, a collection…',
    editor: 'form',
    repeatable: true,
  },
  'product-tabs': {
    label: 'Product tabs',
    description: 'Products with a tab per category.',
    editor: 'form',
    repeatable: true,
  },
  'recently-viewed': {
    label: 'Recently viewed',
    description: 'What this shopper looked at lately.',
    editor: 'form',
    repeatable: false,
  },
  'sale-banner': {
    label: 'Sale banner',
    description: 'A campaign banner with a countdown.',
    editor: 'advanced',
    repeatable: true,
  },
  'collection-grid': {
    label: 'Collection tiles',
    description: 'Tiles linking to collections (Eid, Wedding…).',
    editor: 'form',
    repeatable: true,
  },
  'shop-the-look': {
    label: 'Shop the look',
    description: 'A styled photo with product hotspots.',
    editor: 'advanced',
    repeatable: true,
  },
  testimonials: {
    label: 'Customer reviews',
    description: 'Featured reviews from shoppers.',
    editor: 'form',
    repeatable: false,
  },
  'brand-story': {
    label: 'Brand story',
    description: 'A photo with the brand’s story and a link.',
    editor: 'advanced',
    repeatable: false,
  },
  'instagram-gallery': {
    label: 'Instagram gallery',
    description: 'A grid of Instagram posts.',
    editor: 'advanced',
    repeatable: false,
  },
};

export const isKnownType = (type: string): type is SectionType =>
  Object.hasOwn(SECTION_TYPES, type);

export type SectionState = 'live' | 'hidden' | 'scheduled' | 'ended' | 'invalid';

export const SECTION_STATES: Record<SectionState, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live', tone: 'success' },
  hidden: { label: 'Hidden', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'gold' },
  ended: { label: 'Ended', tone: 'warning' },
  invalid: { label: 'Needs fixing', tone: 'danger' },
};

export function sectionState(
  section: Pick<AdminSectionDto, 'valid' | 'isVisible' | 'startsAt' | 'endsAt'>,
  now = new Date(),
): SectionState {
  if (!section.valid) return 'invalid';
  if (!section.isVisible) return 'hidden';
  if (section.startsAt && new Date(section.startsAt) > now) return 'scheduled';
  if (section.endsAt && new Date(section.endsAt) <= now) return 'ended';
  return 'live';
}

/** Settings a new section of each form-edited type starts from. */
export const DEFAULT_SETTINGS: { [K in SectionType]?: SectionSettingsMap[K] } = {
  hero: { variant: 'default' },
  'trust-bar': { settingKey: 'home.trust-features' },
  'category-grid': { categorySlugs: [] },
  'product-carousel': { title: 'New arrivals', source: { kind: 'newest' }, limit: 8 },
  'product-tabs': { title: 'Shop by category', source: { kind: 'newest' }, tabs: [], limit: 8 },
  'recently-viewed': { minItems: 3 },
  'collection-grid': { title: 'Shop by occasion', collectionSlugs: [] },
  testimonials: { title: 'What our customers say', limit: 6 },
};

/** Types staff can add here (rich types arrive with their own editors). */
export const ADDABLE_TYPES = (Object.keys(SECTION_TYPES) as SectionType[]).filter(
  (type) => DEFAULT_SETTINGS[type] !== undefined,
);

export const SOURCE_LABELS = {
  newest: 'Newest',
  bestsellers: 'Bestsellers',
  'on-sale': 'On sale',
  'top-rated': 'Top rated',
  collection: 'A collection',
  category: 'A category',
} as const;

/** One line about what a section shows, using the shop's names for slugs. */
export function sectionSummary(
  section: Pick<AdminSectionDto, 'type' | 'settings'>,
  names: { categories: ReadonlyMap<string, string>; collections: ReadonlyMap<string, string> },
): string {
  const s = section.settings;
  const title = typeof s.title === 'string' ? s.title : null;
  const list = (slugs: unknown, map: ReadonlyMap<string, string>) =>
    Array.isArray(slugs) && slugs.length
      ? slugs.map((slug) => map.get(String(slug)) ?? String(slug)).join(', ')
      : 'none chosen';
  const source = (value: unknown): string => {
    const src = value as { kind?: keyof typeof SOURCE_LABELS; slug?: string } | undefined;
    if (!src?.kind) return '';
    if (src.kind === 'collection') return names.collections.get(src.slug ?? '') ?? src.slug ?? '';
    if (src.kind === 'category') return names.categories.get(src.slug ?? '') ?? src.slug ?? '';
    return SOURCE_LABELS[src.kind];
  };
  switch (section.type) {
    case 'category-grid':
      return list(s.categorySlugs, names.categories);
    case 'collection-grid':
      return `${title ?? ''} · ${list(s.collectionSlugs, names.collections)}`;
    case 'product-carousel':
      return `${title ?? ''} · ${source(s.source)} · up to ${String(s.limit)}`;
    case 'product-tabs':
      return `${title ?? ''} · tabs: ${list(
        Array.isArray(s.tabs) ? s.tabs.map((t: { categorySlug?: string }) => t.categorySlug) : [],
        names.categories,
      )}`;
    case 'recently-viewed':
      return `Shown after ${String(s.minItems)} viewed products`;
    case 'testimonials':
      return `${title ?? ''} · up to ${String(s.limit)}`;
    default:
      return title ?? (isKnownType(section.type) ? SECTION_TYPES[section.type].description : '');
  }
}
