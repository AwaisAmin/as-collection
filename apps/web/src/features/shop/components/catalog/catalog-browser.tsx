import { ShoppingBag } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import type { CategorySlug } from '@/config/catalog';
import { catalogHref, countActiveFilters } from '@/features/catalog/lib/catalog-url';
import { parseCatalogQuery } from '@/features/catalog/schemas';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { categoryOptions, getCategoryTree } from '@/features/catalog/services/categories';

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

  const [results, facets, tree] = await Promise.all([
    catalogService.listProducts(query),
    catalogService.getFacets({ category: query.category, q: query.q }),
    categoryMode === 'none' ? Promise.resolve([]) : getCategoryTree(),
  ]);

  // A page past the end (an old link, a hand-typed ?page=99) goes to the last page instead of
  // showing "Showing 1177–16 of 16" with an empty grid.
  if (results.total > 0 && results.page > results.pageCount) {
    redirect(catalogHref(basePath, query, { page: results.pageCount }, { includeCategory }));
  }

  const from = results.total === 0 ? 0 : (results.page - 1) * results.pageSize + 1;
  const to = Math.min(results.page * results.pageSize, results.total);
  const panel = {
    query,
    facets,
    basePath,
    categoryMode,
    categories: categoryOptions(tree, query.category),
  };

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
            <ActiveFilters
              query={query}
              basePath={basePath}
              includeCategory={includeCategory}
              showQuery={!includeCategory}
            />
          </div>

          <h2 className="sr-only">Products</h2>
          <PendingRegion>
            <ShopProductGrid
              products={results.items}
              {...(category && !query.q && countActiveFilters(query) === 0
                ? {
                    // A category with nothing in it yet: no filter to remove.
                    empty: (
                      <EmptyState
                        icon={ShoppingBag}
                        title="Nothing here yet"
                        description="New pieces are on the way. Have a look at the rest of the shop meanwhile."
                        action={
                          <ButtonLink href="/shop" withArrow>
                            View all products
                          </ButtonLink>
                        }
                      />
                    ),
                  }
                : {})}
            />
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
