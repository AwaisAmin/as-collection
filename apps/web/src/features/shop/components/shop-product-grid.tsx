import { ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import type { ProductSummary } from '@/features/catalog/types';

import { ShopperActions } from './shop-product-card';

const defaultEmpty = (
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
);

interface ShopProductGridProps {
  products: readonly ProductSummary[];
  preloadCount?: number;
  className?: string;
  /** Override the default "No products found" state (`null` renders nothing). */
  empty?: ReactNode;
}

/**
 * Storefront product grid: catalog cards composed with shopper actions (wishlist now,
 * quick add-to-cart in the cart step). The `shop` feature sits above catalog/wishlist/cart.
 */
export function ShopProductGrid({
  products,
  preloadCount = 4,
  className,
  empty = defaultEmpty,
}: ShopProductGridProps) {
  return (
    <ProductGrid
      products={products}
      preloadCount={preloadCount}
      className={className}
      renderActions={(product) => <ShopperActions product={product} />}
      empty={empty}
    />
  );
}
