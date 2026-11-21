/* Content pages and their sections (`/admin/pages`). */
import type { SectionType } from '../content.js';

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
