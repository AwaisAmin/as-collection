import type { AdminCategoryNodeDto, ProductStatus } from '@as/contracts';
import { z } from 'zod';

/* The product list's URL state: `?status=ACTIVE&q=lawn&category=<id>&low=1&sort=name&page=2`. */

export const PRODUCT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'ARCHIVED', label: 'Archived' },
] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number]['key'];

export const PRODUCT_SORTS = [
  { key: 'updated', label: 'Recently edited' },
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]['key'];

export interface ProductListQuery {
  tab: ProductTab;
  q?: string;
  category?: string;
  /** Kept from links (a brand's product count); not in the filter form. */
  brand?: string;
  low: boolean;
  sort: ProductSort;
  page: number;
}

export const PRODUCT_PAGE_SIZE = 25;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional().catch(undefined));

const schema = z.object({
  status: z.preprocess(first, z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional().catch(undefined)),
  q: optional(z.string().trim().min(1).max(100)),
  category: optional(z.uuid()),
  brand: optional(z.uuid()),
  low: z.preprocess(first, z.enum(['1']).optional().catch(undefined)),
  sort: z.preprocess(
    first,
    z.enum(PRODUCT_SORTS.map((s) => s.key) as [ProductSort, ...ProductSort[]]).catch('updated'),
  ),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});

export function parseProductQuery(searchParams: Record<string, unknown>): ProductListQuery {
  const p = schema.parse(searchParams);
  return {
    tab: p.status ?? 'all',
    low: p.low === '1',
    sort: p.sort,
    page: p.page,
    ...(p.q ? { q: p.q } : {}),
    ...(p.category ? { category: p.category } : {}),
    ...(p.brand ? { brand: p.brand } : {}),
  };
}

export function toProductApiQuery(query: ProductListQuery) {
  return {
    status: query.tab === 'all' ? undefined : (query.tab satisfies ProductStatus),
    q: query.q,
    category: query.category,
    brand: query.brand,
    lowStock: query.low ? 'true' : undefined,
    sort: query.sort,
    page: query.page,
    pageSize: PRODUCT_PAGE_SIZE,
  };
}

export function productListHref(
  query: ProductListQuery,
  change: Partial<ProductListQuery>,
): string {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.tab !== 'all') params.set('status', next.tab);
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  if (next.brand) params.set('brand', next.brand);
  if (next.low) params.set('low', '1');
  if (next.sort !== 'updated') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `/products?${search}` : '/products';
}

/** The category tree as an indented, flat list for a `<select>`. */
export function flattenCategories(
  nodes: readonly AdminCategoryNodeDto[],
): { id: string; label: string; depth: number; isActive: boolean }[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${'— '.repeat(node.depth)}${node.name}`,
      depth: node.depth,
      isActive: node.isActive,
    },
    ...flattenCategories(node.children),
  ]);
}
