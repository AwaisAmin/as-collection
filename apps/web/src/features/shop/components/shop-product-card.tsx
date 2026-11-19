import { ProductCard } from '@/features/catalog/components/product-card';
import type { ProductSummary } from '@/features/catalog/types';
import { QuickViewButton } from '@/features/product/components/quick-view';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';

/** Shopper actions every storefront card carries (wishlist heart + quick view). */
export function ShopperActions({ product }: { product: ProductSummary }) {
  return (
    <>
      <WishlistButton productId={product.id} productName={product.name} />
      <QuickViewButton slug={product.slug} productName={product.name} />
    </>
  );
}

interface ShopProductCardProps {
  product: ProductSummary;
  preload?: boolean;
  className?: string;
}

/** Catalog card composed with shopper actions — used by grids and carousels alike. */
export function ShopProductCard({ product, preload, className }: ShopProductCardProps) {
  return (
    <ProductCard
      product={product}
      preload={preload}
      className={className}
      actions={<ShopperActions product={product} />}
    />
  );
}
