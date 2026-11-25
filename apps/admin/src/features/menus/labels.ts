import type { MenuItemSettingsDto } from '@as/contracts';

/*
 * How the shop reads each menu: how many levels it shows and what the levels mean. The API
 * allows 3 levels everywhere; the editor stops at what the shop actually renders.
 */

export const MAX_MENU_ITEMS = 300;
export const MAX_DEPTH = 3;

export type MenuRole = NonNullable<MenuItemSettingsDto['kind']>;

export interface MenuShape {
  /** Where the shop shows it. */
  where: string;
  /** Levels the shop renders. */
  depth: number;
  /** A word for an item at each level (top first). */
  levels: readonly string[];
  /** Top items choose what they are (the Shop menu's columns and groups). */
  roles?: boolean;
  hint?: string;
}

export const MENU_SHAPES: Readonly<Record<string, MenuShape>> = {
  main: {
    where: 'Header links on every page, and the phone menu.',
    depth: 2,
    levels: ['link', 'sub-link'],
    hint: 'A link with sub-links opens the Shop menu on computers; its sub-links are listed under it in the phone menu.',
  },
  'shop-mega': {
    where: 'The large Shop menu that opens from the header on computers.',
    depth: 2,
    levels: ['column', 'link'],
    roles: true,
    hint: 'Category columns are shown side by side. The first two link groups show as “Shop by occasion” and “Highlights”.',
  },
  footer: {
    where: 'Links at the bottom of every page.',
    depth: 1,
    levels: ['link'],
  },
};

export const shapeOf = (key: string): MenuShape =>
  MENU_SHAPES[key] ?? {
    where: 'Not shown in the shop yet.',
    depth: MAX_DEPTH,
    levels: ['link', 'sub-link', 'sub-link'],
  };

export const ROLE_LABELS: Readonly<Record<MenuRole, { label: string; hint: string }>> = {
  'category-column': {
    label: 'Category column',
    hint: 'A heading linking to a category, with quick links under it.',
  },
  'link-group': { label: 'Link group', hint: 'A titled list of links.' },
  'feature-card': {
    label: 'Feature card',
    hint: 'A picture card filled by the shop (the running sale, or new arrivals).',
  },
};

const HREF_RULES = [
  /^\/(?![/\\])\S*$/,
  /^https:\/\/[^\s/]+\S*$/i,
  /^tel:\+?[0-9-]{6,20}$/,
  /^mailto:[^\s@]+@[^\s@]+$/,
];

/** The API's link rule: a site path, an https address, tel: or mailto:. */
export const isMenuHref = (value: string): boolean =>
  value.length <= 500 && HREF_RULES.some((rule) => rule.test(value));

export const HREF_MESSAGE = 'Use a site path (/shop), an https:// address, tel: or mailto:.';
