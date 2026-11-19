import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

import { discountPercent } from '../lib/product-helpers';
import type { ProductSummary } from '../types';

interface ProductBadgesProps {
  product: Pick<ProductSummary, 'badges' | 'price' | 'compareAtPrice'>;
  /** Max badges to show (cards stay uncluttered). */
  max?: number;
  className?: string;
}

export function ProductBadges({ product, max = 2, className }: ProductBadgesProps) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  const badges = product.badges.slice(0, max);
  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      {badges.map((badge) => {
        switch (badge) {
          case 'sale':
            return (
              <Badge key={badge} tone="gold">
                {discount ? `-${discount}%` : 'Sale'}
              </Badge>
            );
          case 'new':
            return <Badge key={badge}>New</Badge>;
          case 'bestseller':
            return <Badge key={badge}>Bestseller</Badge>;
          case 'sold-out':
            return (
              <Badge key={badge} tone="muted">
                Sold out
              </Badge>
            );
        }
      })}
    </div>
  );
}
