import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import type { ProductSummary } from '../types';
import { ProductCard } from './product-card';

interface ProductGridProps {
  products: readonly ProductSummary[];
  /** Per-card action slot (e.g. wishlist heart). Server-side composition only. */
  renderActions?: (product: ProductSummary) => ReactNode;
  renderFooter?: (product: ProductSummary) => ReactNode;
  /** Shown when `products` is empty. */
  empty?: ReactNode;
  /** Number of leading cards whose images are preloaded (above the fold). */
  preloadCount?: number;
  className?: string;
}

export function ProductGrid({
  products,
  renderActions,
  renderFooter,
  empty = null,
  preloadCount = 0,
  className,
}: ProductGridProps) {
  if (products.length === 0) return <>{empty}</>;

  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4', className)}>
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            actions={renderActions?.(product)}
            footer={renderFooter?.(product)}
            preload={i < preloadCount}
          />
        </li>
      ))}
    </ul>
  );
}
