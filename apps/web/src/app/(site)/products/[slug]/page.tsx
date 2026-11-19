import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProductJsonLd } from '@/components/seo/product-json-ld';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { RatingStars } from '@/components/ui/rating-stars';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { getCategory } from '@/config/catalog';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { DeliveryPerks } from '@/features/product/components/delivery-perks';
import { ProductDetailsTabs } from '@/features/product/components/product-details-tabs';
import { ProductGallery } from '@/features/product/components/product-gallery';
import { PurchasePanel } from '@/features/product/components/purchase-panel';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';
import { pluralize } from '@/lib/utils/format';

export async function generateStaticParams() {
  const slugs = await catalogService.listProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const product = await catalogService.getProductBySlug((await params).slug);
  if (!product) return {};
  const image = product.images[0];
  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description: product.shortDescription,
      images: image ? [{ url: image.src, alt: image.alt }] : undefined,
    },
  };
}

export default function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  return (
    <main id="main-content" className="flex-1">
      <Suspense fallback={<ProductPageSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}

async function ProductContent({ params }: Pick<PageProps<'/products/[slug]'>, 'params'>) {
  const product = await catalogService.getProductBySlug((await params).slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  const related = await catalogService.getRelatedProducts(product, 4);

  return (
    <>
      <ProductJsonLd product={product} />

      <Container className="pt-6 pb-14">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shop', href: '/shop' },
            ...(category ? [{ label: category.name, href: category.href }] : []),
            { label: product.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <ProductGallery images={product.images} productName={product.name} />

          <div className="flex flex-col gap-5">
            {category ? (
              <p className="font-caps text-[13px] tracking-[0.3em] text-gold-dark uppercase">
                {category.name}
              </p>
            ) : null}
            <h1 className="font-display text-[32px]/[1.15] text-ink sm:text-[40px]/[1.12]">
              {product.name}
            </h1>
            {product.rating.count > 0 ? (
              <a href="#reviews" className="inline-flex w-fit items-center gap-2 hover:opacity-80">
                <RatingStars value={product.rating.average} />
                <span className="font-body text-[16px] text-muted underline-offset-4 hover:underline">
                  {product.rating.average.toFixed(1)} · {pluralize(product.rating.count, 'review')}
                </span>
              </a>
            ) : (
              <p className="text-[16px] text-muted">No reviews yet</p>
            )}
            <p className="text-[19px] leading-relaxed text-text">{product.shortDescription}</p>
            <OrnamentDivider width={110} />
            <PurchasePanel product={product} />
            <DeliveryPerks />
            <p className="font-body text-[15px] text-muted">
              SKU: {product.variants[0]?.sku.replace(/-[A-Z0-9]+$/, '') ?? product.id.toUpperCase()}
            </p>
          </div>
        </div>

        <section aria-label="Product information" className="mt-14">
          <ProductDetailsTabs product={product} />
        </section>

        {/* Reviews section (summary, list, write a review) is added in F5. */}
        <div id="reviews" />

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className="mt-20">
            <div id="related-title">
              <SectionHeading title="You may also like" />
            </div>
            <ShopProductGrid products={related} preloadCount={0} className="mt-10" />
          </section>
        ) : null}
      </Container>
    </>
  );
}

function ProductPageSkeleton() {
  return (
    <Container className="pt-6 pb-14">
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <Skeleton className="aspect-[3/4] w-full rounded-card" />
        <div className="flex flex-col gap-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-[52px] w-full rounded-full" />
          <Skeleton className="h-[52px] w-full rounded-full" />
        </div>
      </div>
    </Container>
  );
}
