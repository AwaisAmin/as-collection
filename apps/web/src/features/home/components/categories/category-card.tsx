import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { images } from '@/config/assets';
import type { Category } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';

interface CategoryCardProps {
  category: Category;
  className?: string;
}

/**
 * Whole card is one link (single tab stop); "Shop Now" is styled as a pill but is
 * presentational, avoiding nested/duplicate interactive elements.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  const image = images[category.image];

  return (
    <Link
      href={category.href}
      aria-label={`Shop ${category.name}`}
      className={cn(
        'group relative flex h-[240px] overflow-hidden rounded-card border border-gold bg-ivory shadow-soft sm:h-[280px]',
        'transition-all duration-300 ease-elegant hover:-translate-y-1 hover:shadow-card-hover',
        className,
      )}
    >
      {/* Product image — bleeds to the card's left, top and bottom edges */}
      <div className="relative w-1/2 shrink-0 overflow-hidden sm:w-[55%]">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 230px, (min-width: 768px) 30vw, 50vw"
          className="mask-r-from-80% object-cover transition-transform duration-500 ease-elegant group-hover:scale-105"
        />
      </div>

      {/* Copy column */}
      <div className="flex min-w-0 flex-1 flex-col items-center pt-[22%] pr-2 pb-[46px] text-center sm:pt-[84px] sm:pb-[52px] lg:pr-2 xl:pr-3">
        <h3 className="font-display text-[28px]/[1.02] text-ink lg:text-[26px]/[1.02] xl:text-[32px]/[1.02]">
          {category.titleLines.map((line) => (
            <span key={line} className="block whitespace-nowrap">
              {line}
            </span>
          ))}
        </h3>
        <OrnamentDivider width={88} className="mt-3 shrink-0" />
        <span
          aria-hidden
          className={cn(
            buttonVariants({ size: 'sm' }),
            'mt-auto max-sm:gap-2 max-sm:px-3.5 max-sm:text-[15px]',
          )}
        >
          Shop Now
          <ArrowRight
            size={16}
            strokeWidth={2}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
