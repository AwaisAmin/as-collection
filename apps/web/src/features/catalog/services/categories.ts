import 'server-only';

import type { CategoryDetailDto, CategoryNodeDto, ImageDto } from '@as/contracts';
import type { Route } from 'next';
import { cacheLife, cacheTag } from 'next/cache';

import {
  categories as defaultCategories,
  type Category,
  getCategory as getDefaultCategory,
  isCategorySlug,
  titleLinesFor,
} from '@/config/catalog';
import { env } from '@/config/env';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import { toImageSrc } from './api-mappers';
import { CATALOG_TAG } from './tags';

/*
 * The shop's categories, as managed in the admin (name, picture, banner, order, nesting,
 * hidden or not). The three built-in departments fill in anything the admin left empty and stand
 * in completely while the API can't be reached, so the shop never loses its navigation.
 */

const SITE_ORIGIN = new URL(env.NEXT_PUBLIC_SITE_URL).origin;

export interface StoreCategory extends Category {
  /** Admin text shown under the title (category page). */
  description: string | null;
  children: StoreCategory[];
}

export interface CategoryPage extends Category {
  description: string | null;
  /** Parents first (the category itself is not included). */
  breadcrumbs: readonly { name: string; href: Route }[];
  children: readonly { name: string; href: Route }[];
  seo: { title: string | null; description: string | null };
}

const hrefOf = (slug: string) => `/shop/${slug}` as Route;

function picture(dto: ImageDto | null, alt: string) {
  return dto ? { src: toImageSrc(dto.url, SITE_ORIGIN), alt: dto.alt || alt } : null;
}

/** Admin data over the built-in defaults; a brand-new category uses its own picture throughout. */
function toCategory(
  node: Pick<CategoryNodeDto, 'slug' | 'name' | 'description' | 'image'>,
  banner?: CategoryDetailDto['banner'],
): Category & { description: string | null } {
  const builtIn = getDefaultCategory(node.slug);
  const image = picture(node.image, node.name) ??
    builtIn?.image ?? { src: '/images/hero-model.jpg', alt: '' };
  const bannerImage = picture(banner?.image ?? null, node.name) ?? builtIn?.banner.image ?? image;
  return {
    slug: node.slug,
    name: node.name,
    description: node.description,
    titleLines:
      builtIn && builtIn.name === node.name ? builtIn.titleLines : titleLinesFor(node.name),
    href: hrefOf(node.slug),
    image,
    banner: {
      eyebrow: banner?.eyebrow ?? builtIn?.banner.eyebrow ?? '',
      description: banner?.description ?? node.description ?? builtIn?.banner.description ?? '',
      image: bannerImage,
      ...((banner?.focus ?? builtIn?.banner.focus)
        ? { focus: banner?.focus ?? builtIn?.banner.focus }
        : {}),
    },
  };
}

const fromDefaults = (): StoreCategory[] =>
  defaultCategories.map((c) => ({ ...c, description: null, children: [] }));

function toTree(nodes: readonly CategoryNodeDto[]): StoreCategory[] {
  return nodes
    .filter((n) => isCategorySlug(n.slug))
    .map((n) => ({ ...toCategory(n), children: toTree(n.children) }));
}

/** Top-level categories in the admin's order, each with its sub-categories. */
export async function getCategoryTree(): Promise<StoreCategory[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  try {
    const tree = toTree(await apiRequest<CategoryNodeDto[]>('/catalog/categories'));
    return tree.length ? tree : fromDefaults();
  } catch (error) {
    reportError(error, { action: 'catalog.categories' });
    return fromDefaults();
  }
}

/** Every category at any depth, parents before children. */
export async function getAllCategories(): Promise<StoreCategory[]> {
  const walk = (list: readonly StoreCategory[]): StoreCategory[] =>
    list.flatMap((c) => [c, ...walk(c.children)]);
  return walk(await getCategoryTree());
}

/** A category page (banner, breadcrumbs, sub-categories); null when it doesn't exist or is hidden. */
export async function getCategoryPage(slug: string): Promise<CategoryPage | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CATALOG_TAG);
  if (!isCategorySlug(slug)) return null;
  let detail: CategoryDetailDto | null;
  try {
    detail = await apiFindOrNull<CategoryDetailDto>(`/catalog/categories/${slug}`);
  } catch (error) {
    // API down: the built-in departments still have a page.
    reportError(error, { action: 'catalog.categoryPage' });
    const builtIn = getDefaultCategory(slug);
    return builtIn
      ? {
          ...builtIn,
          description: null,
          breadcrumbs: [],
          children: [],
          seo: { title: null, description: null },
        }
      : null;
  }
  if (!detail) return null;
  return {
    ...toCategory(detail, detail.banner),
    breadcrumbs: detail.breadcrumbs
      .filter((b) => b.slug !== detail.slug)
      .map((b) => ({ name: b.name, href: hrefOf(b.slug) })),
    children: detail.children.map((c) => ({ name: c.name, href: hrefOf(c.slug) })),
    seo: detail.seo,
  };
}

/** The display name of any category slug (product pages, structured data). */
export async function categoryName(slug: string): Promise<string | null> {
  return (await getAllCategories()).find((c) => c.slug === slug)?.name ?? null;
}

/** One line of the shop's Category filter. */
export interface CategoryOption {
  slug: string;
  name: string;
  /** 0 = top level. */
  depth: number;
}

/**
 * The Category filter: every top-level category, and the sub-categories along the branch the
 * shopper is in (so a store with many categories still shows a short list).
 */
export function categoryOptions(
  tree: readonly StoreCategory[],
  current: string | undefined,
): CategoryOption[] {
  const contains = (c: StoreCategory): boolean => c.slug === current || c.children.some(contains);
  const walk = (list: readonly StoreCategory[], depth: number): CategoryOption[] =>
    list.flatMap((c) => [
      { slug: c.slug, name: c.name, depth },
      ...(c.children.length && contains(c) ? walk(c.children, depth + 1) : []),
    ]);
  return walk(tree, 0);
}
