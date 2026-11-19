import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { CatalogBrowser } from '@/features/shop/components/catalog/catalog-browser';
import { CatalogBrowserSkeleton } from '@/features/shop/components/catalog/catalog-browser-skeleton';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Shop unstitched & stitched dresses and makeup at AS Collection Hub.',
  alternates: { canonical: '/shop' },
};

export default function ShopPage({ searchParams }: PageProps<'/shop'>) {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Shop All"
        subtitle="Unstitched & stitched dresses and makeup — curated for every occasion."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop' }]}
      />
      <Container className="py-10">
        <Suspense fallback={<CatalogBrowserSkeleton />}>
          <CatalogBrowser searchParams={searchParams} basePath="/shop" categoryMode="path" />
        </Suspense>
      </Container>
    </main>
  );
}
