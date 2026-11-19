import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SearchForm } from '@/components/layout/header/search-form';
import { PageHeader } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { categories } from '@/config/catalog';
import { parseCatalogQuery } from '@/features/catalog/schemas';
import { CatalogBrowser } from '@/features/shop/components/catalog/catalog-browser';
import { CatalogBrowserSkeleton } from '@/features/shop/components/catalog/catalog-browser-skeleton';

export const metadata: Metadata = {
  title: 'Search',
  // Search result pages shouldn't be indexed (infinite URL space, thin content).
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Search"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Search' }]}
      />
      <Container className="py-10">
        <Suspense
          fallback={
            <>
              <Skeleton className="mx-auto mb-10 h-14 w-full max-w-xl rounded-full" />
              <CatalogBrowserSkeleton />
            </>
          }
        >
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </main>
  );
}

async function SearchResults({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const params = await searchParams;
  const { q } = parseCatalogQuery(params);

  return (
    <>
      <div className="mx-auto mb-10 flex max-w-xl flex-col items-center gap-3 text-center">
        <SearchForm
          inputId="search-page-input"
          label="Search products"
          defaultValue={q}
          size="lg"
          className="w-full"
        />
        {q ? (
          <p className="text-[18px] text-muted">
            Results for <span className="font-semibold text-ink">“{q}”</span>
          </p>
        ) : null}
      </div>

      {q ? (
        <CatalogBrowser
          searchParams={Promise.resolve(params)}
          basePath="/search"
          categoryMode="param"
        />
      ) : (
        <EmptyState
          icon={Search}
          title="What are you looking for?"
          description="Search for lawn, chiffon, kurta, lipstick, foundation and more — or browse a category."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((c) => (
                <ButtonLink key={c.slug} href={c.href} size="sm" withArrow>
                  {c.name}
                </ButtonLink>
              ))}
            </div>
          }
        />
      )}
    </>
  );
}
