import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';
import { catalogService } from '@/features/catalog/services/catalog.service';

export async function generateStaticParams() {
  const slugs = await catalogService.listProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const product = await catalogService.getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.shortDescription } : {};
}

// Temporary — the full product page (gallery, variants, add to cart, reviews) is built in F4/F5.
export default function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  return (
    <Suspense
      fallback={
        <main className="flex-1">
          <Container className="flex flex-col items-center gap-5 py-24">
            <Skeleton className="h-11 w-96 max-w-full" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </Container>
        </main>
      }
    >
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: Pick<PageProps<'/products/[slug]'>, 'params'>) {
  const product = await catalogService.getProductBySlug((await params).slug);
  if (!product) notFound();

  return <PagePlaceholder title={product.name} description={product.shortDescription} />;
}
