'use client';

import { Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Price } from '@/features/catalog/components/price';
import { productHref } from '@/features/catalog/lib/routes';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';

import { useCartLineActions } from '../hooks/use-cart';
import { lineLimit } from '../lib/sync-cart';
import type { CartItem } from '../types';

interface CartLineItemProps {
  item: CartItem;
  /** Drawer layout: smaller image, no unit price. */
  compact?: boolean;
  /** Called when a product link is followed (e.g. close the drawer). */
  onNavigate?: () => void;
}

export function CartLineItem({ item, compact = false, onNavigate }: CartLineItemProps) {
  const { remove, updateQuantity } = useCartLineActions();
  const href = productHref(item.slug);
  const options = Object.entries(item.options);

  return (
    <li
      className={cn(
        'flex gap-4 border-b border-gold/40 py-5 last:border-b-0',
        item.unavailable && 'opacity-70',
      )}
    >
      <Link
        href={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden
        className={cn(
          'relative aspect-3/4 shrink-0 overflow-hidden rounded-lg border border-gold/50 bg-sand',
          compact ? 'w-20' : 'w-24 sm:w-28',
        )}
      >
        <Image src={item.image.src} alt="" fill sizes="112px" className="object-cover" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={href}
            onClick={onNavigate}
            className="font-display text-[16px] leading-snug text-ink transition-colors hover:text-gold-dark sm:text-[17px]"
          >
            {item.name}
          </Link>
          <button
            type="button"
            onClick={() => remove(item)}
            aria-label={`Remove ${item.name} from cart`}
            className="-mt-1 -mr-1 shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <Trash2 aria-hidden size={17} />
          </button>
        </div>

        {options.length > 0 ? (
          <p className="text-[15px] text-muted">
            {options.map(([name, value]) => `${name}: ${value}`).join(' · ')}
          </p>
        ) : null}

        {!compact && !item.unavailable ? (
          <Price price={item.price} compareAtPrice={item.compareAtPrice} className="text-[15px]" />
        ) : null}

        {item.unavailable ? (
          <p className="text-[15px] font-semibold text-gold-dark">
            Sold out — please remove it to continue.
          </p>
        ) : (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
            <QuantityStepper
              size="sm"
              value={item.quantity}
              max={Math.max(1, lineLimit(item.maxQuantity))}
              onChange={(q) => updateQuantity(item.variantId, q)}
              label={item.name}
            />
            <p className="font-body text-[17px] font-bold text-ink">
              <span className="sr-only">Line total: </span>
              {formatPrice(item.price * item.quantity)}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
