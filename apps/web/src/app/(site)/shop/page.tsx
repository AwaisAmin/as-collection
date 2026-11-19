import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { parseCatalogQuery } from '@/features/catalog/schemas';
import { catalogService } from '@/features/catalog/services/catalog.service';
import { ShopProductGrid } from '@/features/shop/components/shop-product-grid';
import { pluralize } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Shop unstitched & stitched dresses and makeup at AS Collection Hub.',
};

// Filters, sorting and pagination arrive in the next step (F3).
export default async function ShopPage() {
  const { items, total } = await catalogService.listProducts(parseCatalogQuery({}), 48);

  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Shop All"
        subtitle="Unstitched & stitched dresses and makeup — curated for every occasion."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop' }]}
      />
      <Container className="py-10">
        <p className="mb-6 text-[17px] text-muted">{pluralize(total, 'product')}</p>
        <ShopProductGrid products={items} />
      </Container>
    </main>
  );
}
