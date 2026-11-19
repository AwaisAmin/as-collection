import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';
import { categories, getCategory } from '@/config/catalog';
import { ProductGridSkeleton } from '@/features/catalog/components/product-card-skeleton';
import { parseCatalogQuery } from '@/features/catalog/schemas';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';
import { pluralize } from '@/lib/utils/format';

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
  };
}

/** Shell renders instantly; URL-dependent content streams in (Cache Components pattern). */
export default function CategoryPage({ params }: PageProps<'/shop/[category]'>) {
  return (
    <main id="main-content" className="flex-1">
      <Suspense fallback={<CategoryFallback />}>
        <CategoryContent params={params} />
      </Suspense>
    </main>
  );
}

async function CategoryContent({ params }: Pick<PageProps<'/shop/[category]'>, 'params'>) {
  const category = getCategory((await params).category);
  if (!category) notFound();

  const { items, total } = await catalogService.listProducts(
    parseCatalogQuery({}, { category: category.slug }),
    48,
  );

  return (
    <>
      <PageHeader
        title={category.name}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/shop' },
          { label: category.name },
        ]}
      />
      <Container className="py-10">
        <p className="mb-6 text-[17px] text-muted">{pluralize(total, 'product')}</p>
        <ShopProductGrid products={items} />
      </Container>
    </>
  );
}

function CategoryFallback() {
  return (
    <>
      <div className="border-b border-gold/50 bg-sand">
        <Container className="flex flex-col items-center gap-5 py-9 sm:py-11">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-11 w-72" />
        </Container>
      </div>
      <Container className="py-10">
        <Skeleton className="mb-6 h-5 w-24" />
        <ProductGridSkeleton />
      </Container>
    </>
  );
}
