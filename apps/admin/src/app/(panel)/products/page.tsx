import type { AdminCategoryNodeDto, AdminProductListDto } from '@as/contracts';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { TabsNav } from '@/components/ui/tabs-nav';
import { ProductFilters } from '@/features/products/components/product-filters';
import { ProductTable } from '@/features/products/components/product-table';
import {
  flattenCategories,
  parseProductQuery,
  PRODUCT_PAGE_SIZE,
  PRODUCT_TABS,
  productListHref,
  toProductApiQuery,
} from '@/features/products/query';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const params = await searchParams;
  const query = parseProductQuery(params);

  const [list, tree] = await Promise.all([
    apiRequest<AdminProductListDto>('/admin/products', {
      token,
      query: toProductApiQuery(query),
    }).catch(() => null),
    apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }).catch(() => []),
  ]);
  const filtered = Boolean(query.q || query.category || query.low || query.brand);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Products</h1>
          <p className="text-[14px] text-muted">
            Everything you sell, with prices, options and stock.
          </p>
        </div>
        {can(permissions, 'catalog.write') ? (
          <ButtonLink href="/products/new">
            <Plus aria-hidden size={17} />
            New product
          </ButtonLink>
        ) : null}
      </div>

      {params.deleted === '1' ? <Alert tone="success">The product was deleted.</Alert> : null}

      <TabsNav
        label="Product status"
        tabs={PRODUCT_TABS.map((tab) => ({
          href: productListHref(query, { tab: tab.key }),
          label: tab.label,
          active: tab.key === query.tab,
        }))}
      />
      <ProductFilters query={query} categories={flattenCategories(tree)} />

      {!list ? (
        <Alert tone="error">Products could not be loaded right now. Refresh to try again.</Alert>
      ) : list.items.length ? (
        <>
          <ProductTable products={list.items} />
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            pageSize={PRODUCT_PAGE_SIZE}
            href={(page) => productListHref(query, { page })}
          />
        </>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{filtered ? 'No products match' : 'No products here yet'}</p>
          <p className="text-[14px] text-muted">
            {filtered ? 'Try a different search or clear the filters.' : 'Add one to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
