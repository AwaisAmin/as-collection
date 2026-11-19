import { ShoppingBag } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import type { ProductSummary } from '@/features/catalog/types';
import { QuickViewButton } from '@/features/product/components/quick-view';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';

interface ShopProductGridProps {
  products: readonly ProductSummary[];
  preloadCount?: number;
  className?: string;
}

/**
 * Storefront product grid: catalog cards composed with shopper actions (wishlist now,
 * quick add-to-cart in the cart step). The `shop` feature sits above catalog/wishlist/cart.
 */
export function ShopProductGrid({ products, preloadCount = 4, className }: ShopProductGridProps) {
  return (
    <ProductGrid
      products={products}
      preloadCount={preloadCount}
      className={className}
      renderActions={(product) => (
        <>
          <WishlistButton productId={product.id} productName={product.name} />
          <QuickViewButton slug={product.slug} productName={product.name} />
        </>
      )}
      empty={
        <EmptyState
          icon={ShoppingBag}
          title="No products found"
          description="Try removing a filter or searching for something else."
          action={
            <ButtonLink href="/shop" withArrow>
              View all products
            </ButtonLink>
          }
        />
      }
    />
  );
}
