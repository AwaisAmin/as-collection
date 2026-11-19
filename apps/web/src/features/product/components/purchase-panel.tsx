'use client';

import { CircleAlert, ShoppingBag, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { MAX_PER_LINE, useCartStore, useCartUi } from '@/features/cart/store/cart-store';
import { Price } from '@/features/catalog/components/price';
import { compareAtFor, findVariant, minPrice } from '@/features/catalog/lib/product-helpers';
import type { Product, ProductVariant } from '@/features/catalog/types';
import { WishlistButton } from '@/features/wishlist/components/wishlist-button';
import { cn } from '@/lib/utils/cn';

import {
  initialSelection,
  isValueAvailable,
  missingOptions,
  type Selection,
  stockStatus,
} from '../lib/variant-selection';
import { SizeGuide } from './size-guide';

interface PurchasePanelProps {
  product: Product;
  /** Called after a successful add (quick view closes itself). */
  onAdded?: () => void;
}

export function PurchasePanel({ product, onAdded }: PurchasePanelProps) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const openCartDrawer = useCartUi((s) => s.open);
  const [selected, setSelected] = useState<Selection>(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const errorId = useId();

  const variant: ProductVariant | undefined =
    missingOptions(product, selected).length === 0 ? findVariant(product, selected) : undefined;
  const stock = variant ? stockStatus(variant.stock) : null;
  const soldOut = product.variants.every((v) => v.stock <= 0) || stock?.level === 'out';
  const maxQty = Math.max(1, Math.min(variant?.stock ?? MAX_PER_LINE, MAX_PER_LINE));

  function choose(option: string, value: string) {
    setSelected((s) => ({ ...s, [option]: value }));
    setQuantity(1);
    setError(null);
  }

  /** Returns true when the item is in the cart. */
  function add({ openCart = true }: { openCart?: boolean } = {}): boolean {
    const missing = missingOptions(product, selected);
    if (missing.length > 0 || !variant) {
      setError(`Please select a ${missing[0]?.toLowerCase() ?? 'option'}.`);
      optionsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      return false;
    }
    const result = addItem(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sku: variant.sku,
        options: variant.options,
        image: product.images[0] ?? { src: '/images/hero-model.jpg', alt: product.name },
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        maxQuantity: variant.stock,
      },
      quantity,
    );

    if (result.added === 0) {
      toast.error('You already have the maximum quantity in your cart.', {
        description: product.name,
      });
      return true;
    }
    if (result.capped) {
      toast('Quantity limited to available stock', { description: product.name });
    }
    onAdded?.();
    // The mini cart is the confirmation (shows the line, totals and checkout).
    if (openCart) openCartDrawer();
    return true;
  }

  function buyNow() {
    if (add({ openCart: false })) router.push('/checkout');
  }

  return (
    <div className="flex flex-col gap-6">
      <Price
        size="lg"
        price={variant?.price ?? minPrice(product)}
        compareAtPrice={variant ? variant.compareAtPrice : compareAtFor(product)}
        from={!variant && new Set(product.variants.map((v) => v.price)).size > 1}
        showDiscount
      />

      {product.options.length > 0 ? (
        <div ref={optionsRef} className="flex flex-col gap-5">
          {product.options.map((option) => {
            const current = selected[option.name];
            const isShade = option.values.some((v) => v.swatch);
            return (
              <fieldset key={option.name} aria-describedby={error ? errorId : undefined}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <legend className="font-display text-[18px] text-ink">
                    {option.name}
                    {current ? (
                      <span className="font-body text-[17px] text-muted">: {current}</span>
                    ) : null}
                  </legend>
                  {option.name === 'Size' && product.sizeGuide ? <SizeGuide /> : null}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {option.values.map(({ value, swatch }) => {
                    const available = isValueAvailable(product, selected, option.name, value);
                    const isSelected = current === value;
                    const label = `${value}${available ? '' : ' (sold out)'}`;
                    return isShade ? (
                      <button
                        key={value}
                        type="button"
                        onClick={() => choose(option.name, value)}
                        disabled={!available}
                        aria-pressed={isSelected}
                        aria-label={label}
                        title={label}
                        className={cn(
                          'relative size-11 rounded-full border-[3px] transition-shadow disabled:cursor-not-allowed',
                          isSelected
                            ? 'border-ivory shadow-[0_0_0_2px_var(--color-ink)]'
                            : 'border-ivory shadow-[0_0_0_1px_var(--color-gold)] hover:shadow-[0_0_0_2px_var(--color-gold)]',
                          !available &&
                            'opacity-40 after:absolute after:inset-0 after:m-auto after:h-0.5 after:w-[120%] after:-translate-x-[8%] after:rotate-45 after:bg-ink',
                        )}
                        style={{ backgroundColor: swatch }}
                      />
                    ) : (
                      <button
                        key={value}
                        type="button"
                        onClick={() => choose(option.name, value)}
                        disabled={!available}
                        aria-pressed={isSelected}
                        aria-label={label}
                        className={cn(
                          'min-w-[52px] rounded-full border-[1.5px] px-4 py-2 font-body text-[17px] font-bold transition-colors',
                          isSelected
                            ? 'border-gold bg-ink text-white'
                            : 'border-gold/60 text-text hover:border-gold',
                          !available &&
                            'cursor-not-allowed border-muted/25 text-muted/50 line-through hover:border-muted/25',
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : null}

      <div aria-live="polite" className="min-h-6">
        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-2 text-[16px] font-semibold text-gold-dark"
          >
            <CircleAlert aria-hidden size={18} />
            {error}
          </p>
        ) : stock ? (
          <p className="flex items-center gap-2 text-[16px]">
            <span
              aria-hidden
              className={cn(
                'size-2.5 rounded-full',
                stock.level === 'in' ? 'bg-ink' : stock.level === 'low' ? 'bg-gold' : 'bg-muted/50',
              )}
            />
            <span
              className={cn(stock.level === 'low' ? 'font-semibold text-gold-dark' : 'text-muted')}
            >
              {stock.label}
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          max={maxQty}
          label={product.name}
          disabled={soldOut}
        />
        <Button
          size="lg"
          onClick={() => add()}
          disabled={soldOut}
          className="h-[52px] min-w-0 flex-1 text-[20px] max-sm:order-last max-sm:basis-full sm:text-[22px]"
        >
          <ShoppingBag aria-hidden size={20} />
          {soldOut ? 'Sold out' : 'Add to Cart'}
        </Button>
        <WishlistButton productId={product.id} productName={product.name} variant="inline" />
      </div>

      {!soldOut ? (
        <Button
          variant="gold"
          size="lg"
          onClick={buyNow}
          className="h-[52px] w-full text-[20px] sm:text-[22px]"
        >
          <Zap aria-hidden size={20} />
          Buy Now
        </Button>
      ) : null}
    </div>
  );
}
