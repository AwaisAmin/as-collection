import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Container } from '@/components/ui/container';
import { categories } from '@/config/catalog';
import { getCategoryPage } from '@/features/catalog/services/categories';
import { getStoreSettings } from '@/features/content/services/store-content';
import { CatalogBrowser } from '@/features/shop/components/catalog/catalog-browser';
import { CatalogBrowserSkeleton } from '@/features/shop/components/catalog/catalog-browser-skeleton';
import { CategoryBanner, CategoryBannerSkeleton } from '@/features/shop/components/category-banner';
import { formatPrice } from '@/lib/utils/format';

/** The built-in departments are prebuilt; categories added in the admin render on first visit. */
export function generateStaticParams() {
  return categories.map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const category = await getCategoryPage((await params).category);
  if (!category) return { title: 'Page not found', robots: { index: false } };
  // The admin's search texts win; otherwise the free-delivery amount follows the store setting.
  const { shipping, profile } = await getStoreSettings();
  return {
    title: category.seo.title ?? category.name,
    description:
      category.seo.description ??
      `Shop ${category.name.toLowerCase()} at ${profile.name} — free delivery on orders above ${formatPrice(shipping.freeShippingThreshold)} and cash on delivery.`,
    alternates: { canonical: category.href },
  };
}

/** Shell renders instantly; URL-dependent content streams in (Cache Components pattern). */
export default function CategoryPage({ params, searchParams }: PageProps<'/shop/[category]'>) {
  return (
    <main id="main-content" className="flex-1">
      <Suspense fallback={<CategoryFallback />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CategoryContent({ params, searchParams }: PageProps<'/shop/[category]'>) {
  const category = await getCategoryPage((await params).category);
  if (!category) notFound();

  return (
    <>
      <CategoryBanner category={category} />
      <Container className="py-10">
        <Suspense fallback={<CatalogBrowserSkeleton />}>
          <CatalogBrowser
            searchParams={searchParams}
            basePath={category.href}
            category={category.slug}
            categoryMode="path"
          />
        </Suspense>
      </Container>
    </>
  );
}

function CategoryFallback() {
  return (
    <>
      <CategoryBannerSkeleton />
      <Container className="py-10">
        <CatalogBrowserSkeleton />
      </Container>
    </>
  );
}
