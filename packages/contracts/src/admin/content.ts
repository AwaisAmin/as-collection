/* Content pages and their sections (`/admin/pages`), menus and store settings. */
import type { MenuItemSettingsDto, PublicSettingsDto, SectionType } from '../content.js';

export type PageStatus = 'DRAFT' | 'PUBLISHED';

export interface AdminPageListItemDto {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  updatedAt: string;
  sections: number;
  /** The shop needs it (home): it can't be deleted or renamed. */
  protected: boolean;
}

export interface AdminSectionDto {
  id: string;
  /** One of the section types; older rows may hold a type the shop no longer knows. */
  type: SectionType | (string & {});
  /** Validated by the type's schema on every save. */
  settings: Record<string, unknown>;
  position: number;
  isVisible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Send back as `updatedAt` when saving (conflict detection). */
  updatedAt: string;
  /** False: its settings no longer match the type (the shop skips it). */
  valid: boolean;
  /** Shown in the shop right now (valid, visible and inside its schedule). */
  live: boolean;
}

export interface AdminPageDto {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
  sections: AdminSectionDto[];
}

// ─── Menus (`/admin/menus`) ───

export interface AdminMenuListItemDto {
  id: string;
  key: string;
  name: string;
  updatedAt: string;
  /** Items at every level, hidden ones included. */
  items: number;
  /** The shop reads it: it can't be deleted. */
  protected: boolean;
}

export interface AdminMenuItemDto {
  id: string;
  label: string;
  url: string | null;
  openInNewTab: boolean;
  /** Hidden items (and everything under them) stay out of the shop. */
  isVisible: boolean;
  settings: MenuItemSettingsDto | null;
  children: AdminMenuItemDto[];
}

/** The whole tree; saved back whole with `PUT /admin/menus/:key` (same shape, no ids). */
export interface AdminMenuDto {
  key: string;
  name: string;
  updatedAt: string;
  items: AdminMenuItemDto[];
}

// ─── Store settings (`/admin/settings`) ───

/** Every editable setting key with its value type (the same shapes the shop reads). */
export type StoreSettingValues = Required<PublicSettingsDto>;
export type StoreSettingKey = keyof StoreSettingValues;

export interface AdminSettingDto<K extends StoreSettingKey = StoreSettingKey> {
  key: K;
  /** What it is, in a few words. */
  label: string;
  /** Null until first saved. */
  value: StoreSettingValues[K] | null;
  /** False: the stored value fails its rules, so the shop ignores it. */
  valid: boolean;
  /** Send back as `updatedAt` when saving (null for a first save). */
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}
