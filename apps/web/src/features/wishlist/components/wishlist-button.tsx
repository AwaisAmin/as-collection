'use client';

import { Heart } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';

import { useIsWishlisted } from '../hooks/use-wishlist';
import { useWishlistStore } from '../store/wishlist-store';

interface WishlistButtonProps {
  productId: string;
  productName: string;
  /** `floating` = round ivory button over images; `inline` = bordered pill next to Add to Cart. */
  variant?: 'floating' | 'inline';
  className?: string;
}

export function WishlistButton({
  productId,
  productName,
  variant = 'floating',
  className,
}: WishlistButtonProps) {
  const active = useIsWishlisted(productId);
  const toggle = useWishlistStore((s) => s.toggle);

  function handleClick() {
    const added = toggle(productId);
    toast.success(added ? 'Added to your wishlist' : 'Removed from your wishlist', {
      description: productName,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-200',
        variant === 'floating'
          ? 'size-9 rounded-full border border-gold/60 bg-ivory/90 text-ink shadow-soft backdrop-blur-sm hover:scale-105 hover:border-gold'
          : 'size-13 shrink-0 rounded-full border-[1.5px] border-gold bg-transparent text-ink hover:bg-ivory',
        className,
      )}
    >
      <Heart
        aria-hidden
        size={variant === 'floating' ? 18 : 22}
        strokeWidth={1.6}
        className={cn(
          'transition-colors duration-200',
          active ? 'fill-gold-dark text-gold-dark' : 'text-ink',
        )}
      />
    </button>
  );
}
