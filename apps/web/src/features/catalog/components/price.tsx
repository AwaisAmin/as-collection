import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';

import { discountPercent } from '../lib/product-helpers';
import type { Money } from '../types';

interface PriceProps {
  price: Money;
  compareAtPrice?: Money;
  /** Prefix "From" when variants have different prices. */
  from?: boolean;
  size?: 'sm' | 'lg';
  showDiscount?: boolean;
  className?: string;
}

/** Current price, struck-through original price, optional "-17%" — with screen-reader labels. */
export function Price({
  price,
  compareAtPrice,
  from = false,
  size = 'sm',
  showDiscount = false,
  className,
}: PriceProps) {
  const discount = discountPercent(price, compareAtPrice);
  const onSale = discount !== undefined;

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-body', className)}>
      <span
        className={cn(
          'font-bold text-ink',
          size === 'lg' ? 'text-[28px] leading-none' : 'text-[18px]',
        )}
      >
        {onSale ? <span className="sr-only">Sale price: </span> : null}
        {from ? 'From ' : null}
        {formatPrice(price)}
      </span>
      {onSale ? (
        <>
          <s className={cn('text-muted', size === 'lg' ? 'text-[20px]' : 'text-[15px]')}>
            <span className="sr-only">Original price: </span>
            {formatPrice(compareAtPrice!)}
          </s>
          {showDiscount ? (
            <span className="rounded-full bg-gold-gradient px-2 py-0.5 text-[13px] font-bold text-ink">
              Save {discount}%
            </span>
          ) : null}
        </>
      ) : null}
    </p>
  );
}
