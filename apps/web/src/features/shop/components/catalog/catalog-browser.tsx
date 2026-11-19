import { Pagination } from '@/components/ui/pagination';
import type { CategorySlug } from '@/config/catalog';
import { catalogHref } from '@/features/catalog/lib/catalog-url';
import { parseCatalogQuery } from '@/features/catalog/schemas';
import { catalogService } from '@/features/catalog/services/catalog.service';

import { ShopProductGrid } from '../shop-product-grid';
import { ActiveFilters } from './active-filters';
import { CatalogNavigationProvider, PendingRegion } from './catalog-navigation';
import { FilterPanel } from './filter-panel';
import { MobileFilters } from './mobile-filters';
import { SortSelect } from './sort-select';

export type SearchParams = Record<string, string | string[] | undefined>;

interface CatalogBrowserProps {
  searchParams: Promise<SearchParams>;
  basePath: string;
  /** Fixed category (category pages). */
  category?: CategorySlug;
  /** How the category filter behaves: links to category pages, a query param, or hidden. */
  categoryMode?: 'path' | 'param' | 'none';
}

/**
 * Filters + sort + results + pagination, all driven by the URL.
 * Server component: reads search params, fetches (cached) results and facets.
 */
export async function CatalogBrowser({
  searchParams,
  basePath,
  category,
  categoryMode = 'none',
}: CatalogBrowserProps) {
  const query = parseCatalogQuery(await searchParams, category ? { category } : {});
  const includeCategory = categoryMode === 'param';

  const [results, facets] = await Promise.all([
    catalogService.listProducts(query),
    catalogService.getFacets({ category: query.category, q: query.q }),
  ]);

  const from = results.total === 0 ? 0 : (results.page - 1) * results.pageSize + 1;
  const to = Math.min(results.page * results.pageSize, results.total);
  const panel = { query, facets, basePath, categoryMode };

  return (
    <CatalogNavigationProvider>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr] xl:gap-10">
        <aside aria-label="Product filters" className="hidden lg:block">
          <div className="sticky top-6 rounded-card border border-gold/60 bg-ivory px-5 py-2">
            <h2 className="sr-only">Filters</h2>
            <FilterPanel {...panel} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-[17px] text-muted">
              {results.total === 0
                ? 'No products'
                : `Showing ${from}–${to} of ${results.total} ${results.total === 1 ? 'product' : 'products'}`}
            </p>
            <div className="flex items-center gap-2">
              <MobileFilters {...panel} total={results.total} />
              <SortSelect query={query} basePath={basePath} includeCategory={includeCategory} />
            </div>
          </div>

          <div className="mb-5">
            <ActiveFilters query={query} basePath={basePath} includeCategory={includeCategory} />
          </div>

          <h2 className="sr-only">Products</h2>
          <PendingRegion>
            <ShopProductGrid products={results.items} />
          </PendingRegion>

          <Pagination
            className="mt-10"
            page={results.page}
            pageCount={results.pageCount}
            hrefFor={(page) => catalogHref(basePath, query, { page }, { includeCategory })}
          />
        </div>
      </div>
    </CatalogNavigationProvider>
  );
}
