import { z } from 'zod';

import { clearableText, plainText } from '../../../common/text.js';
import { slugSchema } from '../../catalog/catalog.schemas.js';
import {
  hrefSchema,
  menuItemSettingsSchema,
  menuKeySchema,
  SECTION_SCHEMAS,
} from '../content.schemas.js';

const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
const instant = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
const updatedAt = instant;

// ─── Pages ───

const pageFields = {
  slug: slugSchema.max(120),
  title: plainText({ min: 1, max: 160 }),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  seoTitle: clearableText({ max: 160 }),
  seoDescription: clearableText({ max: 320 }),
};

export const createPageSchema = z.object({
  ...pageFields,
  status: pageFields.status.default('DRAFT'),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object(pageFields).partial().extend({ updatedAt });
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

// ─── Sections ───

export const sectionTypes = Object.keys(SECTION_SCHEMAS) as [
  keyof typeof SECTION_SCHEMAS,
  ...(keyof typeof SECTION_SCHEMAS)[],
];

const windowCheck = (
  s: { startsAt?: Date | null | undefined; endsAt?: Date | null | undefined },
  ctx: z.RefinementCtx,
) => {
  if (s.startsAt && s.endsAt && s.endsAt <= s.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'must be after the start' });
  }
};

/**
 * `settings` is validated by the section type's schema — the same one the storefront reads
 * with — and stored as parsed (unknown keys dropped).
 */
export const createSectionSchema = z
  .object({
    type: z.enum(sectionTypes),
    settings: z.record(z.string(), z.unknown()),
    isVisible: z.boolean().default(true),
    startsAt: nullable(instant).default(null),
    endsAt: nullable(instant).default(null),
    /** Insert at this index (default: last). */
    position: z.number().int().min(0).max(1_000).optional(),
  })
  .superRefine(windowCheck);
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

/** The type is fixed; `settings` replaces the whole object. */
export const updateSectionSchema = z
  .object({
    settings: z.record(z.string(), z.unknown()),
    isVisible: z.boolean(),
    startsAt: nullable(instant),
    endsAt: nullable(instant),
  })
  .partial()
  .extend({ updatedAt })
  .superRefine(windowCheck);
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const reorderIdsSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'each id once' }),
});

// ─── Menus ───

export const MAX_MENU_DEPTH = 3;
export const MAX_MENU_ITEMS = 300;

export interface MenuItemInput {
  label: string;
  url: string | null;
  openInNewTab: boolean;
  isVisible: boolean;
  settings: z.infer<typeof menuItemSettingsSchema> | null;
  children: MenuItemInput[];
}

const menuItemSchema: z.ZodType<MenuItemInput> = z.lazy(() =>
  z.object({
    label: plainText({ min: 1, max: 80 }),
    url: nullable(hrefSchema).default(null),
    openInNewTab: z.boolean().default(false),
    isVisible: z.boolean().default(true),
    settings: nullable(menuItemSettingsSchema).default(null),
    children: z.array(menuItemSchema).max(100).default([]),
  }),
);

const depthOf = (items: MenuItemInput[]): number =>
  items.length ? 1 + Math.max(...items.map((i) => depthOf(i.children))) : 0;
const countOf = (items: MenuItemInput[]): number =>
  items.reduce((sum, i) => sum + 1 + countOf(i.children), 0);

/** Replaces the whole menu (the editor saves the tree it shows). */
export const putMenuSchema = z
  .object({
    name: plainText({ min: 1, max: 120 }),
    items: z.array(menuItemSchema).max(100),
    /** From your last read; null when creating the menu. */
    updatedAt: nullable(updatedAt),
  })
  .superRefine((menu, ctx) => {
    if (depthOf(menu.items) > MAX_MENU_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: `Menus nest at most ${String(MAX_MENU_DEPTH)} levels deep.`,
      });
    }
    if (countOf(menu.items) > MAX_MENU_ITEMS) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: `At most ${String(MAX_MENU_ITEMS)} items per menu.`,
      });
    }
  });
export type PutMenuInput = z.infer<typeof putMenuSchema>;

export const menuKeyParamSchema = menuKeySchema;

// ─── Settings ───

export const putSettingSchema = z.object({
  /** Validated by the key's own schema. */
  value: z.unknown(),
  /** From your last read; null when the setting does not exist yet. */
  updatedAt: nullable(updatedAt),
});
