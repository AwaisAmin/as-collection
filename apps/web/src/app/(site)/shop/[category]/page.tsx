import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Container } from '@/components/ui/container';
import { categories, getCategory } from '@/config/catalog';
import { CatalogBrowser } from '@/features/shop/components/catalog/catalog-browser';
import { CatalogBrowserSkeleton } from '@/features/shop/components/catalog/catalog-browser-skeleton';
import { CategoryBanner, CategoryBannerSkeleton } from '@/features/shop/components/category-banner';

export function generateStaticParams() {
  return categories.map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const category = getCategory((await params).category);
  if (!category) return { title: 'Shop' };
  return {
    title: category.name,
    description: `Shop ${category.name.toLowerCase()} at AS Collection Hub — free shipping on orders above 2500 and cash on delivery.`,
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
  const category = getCategory((await params).category);
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
