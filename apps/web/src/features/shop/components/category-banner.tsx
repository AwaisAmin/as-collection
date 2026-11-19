import Image from 'next/image';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { Skeleton } from '@/components/ui/skeleton';
import type { Category } from '@/config/catalog';

const frame = 'relative isolate overflow-hidden border-b border-gold/60 bg-ink';
const height = 'min-h-65 sm:min-h-75 lg:min-h-85';

/**
 * Category page hero: copy on black at the left, the category photo fading in from the right.
 * On phones the photo sits behind the copy under a dark overlay.
 */
export function CategoryBanner({ category }: { category: Category }) {
  const { banner } = category;

  return (
    <div className={frame}>
      <div className="absolute inset-y-0 right-0 -z-10 w-full md:w-[58%]">
        <Image
          src={banner.image.src}
          alt=""
          fill
          preload
          sizes="(min-width: 768px) 58vw, 100vw"
          className="object-cover"
          style={{ objectPosition: banner.focus ?? '50% 50%' }}
        />
        {/* Phones: even overlay. md+: fade from solid black into the photo. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-ink/70 md:bg-transparent md:bg-linear-to-r md:from-ink md:via-ink/55 md:to-ink/5"
        />
      </div>

      <Container className={`flex flex-col justify-center gap-4 py-10 text-white ${height}`}>
        <Breadcrumbs
          tone="light"
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shop', href: '/shop' },
            { label: category.name },
          ]}
        />
        <p className="font-caps text-[13px] tracking-[0.3em] text-gold-light uppercase">
          {banner.eyebrow}
        </p>
        <h1 className="font-display text-[38px]/[1.08] sm:text-[50px]/[1.05]">{category.name}</h1>
        <OrnamentDivider width={110} className="text-gold-light" />
        <p className="max-w-md text-[18px] text-white/85 sm:text-[19px]">{banner.description}</p>
      </Container>
    </div>
  );
}

export function CategoryBannerSkeleton() {
  return (
    <div className={frame}>
      <Container className={`flex flex-col justify-center gap-4 py-10 ${height}`}>
        <Skeleton className="h-4 w-48 bg-white/10" />
        <Skeleton className="h-3 w-32 bg-white/10" />
        <Skeleton className="h-11 w-72 bg-white/10" />
        <Skeleton className="h-5 w-80 max-w-full bg-white/10" />
      </Container>
    </div>
  );
}
