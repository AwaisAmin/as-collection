'use client';

import { Heart, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useCartStore, useCartUi } from '@/features/cart/store/cart-store';
import { ProductGridSkeleton } from '@/features/catalog/components/product-card-skeleton';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import { productHref } from '@/features/catalog/lib/routes';
import type { ProductSummary } from '@/features/catalog/types';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';
import { useWishlistIds } from '@/features/wishlist/hooks/use-wishlist';
import { useWishlistStore } from '@/features/wishlist/store/wishlist-store';
import { useHydrated } from '@/hooks/use-hydrated';
import { pluralize } from '@/lib/utils/format';

import { getProductsByIds, getVariantForCart } from '../actions';

function MoveToCart({ product }: { product: ProductSummary }) {
  const [isPending, startTransition] = useTransition();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartUi((s) => s.open);
  const removeFromWishlist = useWishlistStore((s) => s.remove);

  if (!product.inStock) {
    return (
      <Button size="sm" disabled className="w-full">
        Sold out
      </Button>
    );
  }

  if (!product.quickAddVariantId) {
    return (
      <ButtonLink href={productHref(product.slug)} size="sm" className="w-full">
        <SlidersHorizontal aria-hidden size={15} />
        Choose options
      </ButtonLink>
    );
  }

  const variantId = product.quickAddVariantId;
  return (
    <Button
      size="sm"
      className="w-full"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const v = await getVariantForCart(variantId);
          if (!v || v.stock <= 0) {
            toast.error('Sorry, this item just sold out.');
            return;
          }
          addItem({
            variantId: v.variantId,
            productId: v.productId,
            slug: v.slug,
            name: v.name,
            sku: v.sku,
            options: v.options,
            image: v.image,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            maxQuantity: v.stock,
          });
          removeFromWishlist(product.id);
          openCart();
        })
      }
    >
      <ShoppingBag aria-hidden size={15} />
      {isPending ? 'Adding…' : 'Move to cart'}
    </Button>
  );
}

/** Wishlist ids live in the browser; product data is fetched fresh from the server. */
export function WishlistView({ suggestions }: { suggestions?: ReactNode }) {
  const hydrated = useHydrated();
  const ids = useWishlistIds();
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [, startTransition] = useTransition();
  const key = ids.join(',');

  useEffect(() => {
    if (!hydrated) return;
    startTransition(async () => {
      setProducts(key ? await getProductsByIds(key.split(',')) : []);
    });
  }, [hydrated, key]);

  if (!hydrated || products === null) return <ProductGridSkeleton count={4} />;

  // Keep the store's order and hide anything already removed.
  const visible = products.filter((p) => ids.includes(p.id));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col gap-16">
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here for later."
          action={
            <ButtonLink href="/shop" withArrow>
              Explore the collection
            </ButtonLink>
          }
        />
        {suggestions}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-body text-[17px] font-medium text-muted">
        {pluralize(visible.length, 'saved item')}
      </h2>
      <ProductGrid
        products={visible}
        renderActions={(p) => <WishlistButton productId={p.id} productName={p.name} />}
        renderFooter={(p) => <MoveToCart product={p} />}
      />
    </div>
  );
}
