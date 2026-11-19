import Image from 'next/image';

import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { activePromotion, type Promotion } from '@/config/promotions';

import { Countdown, UntilExpiry } from './countdown';

interface SaleBannerProps {
  promotion?: Promotion | null;
}

/** Black-and-gold campaign band with a live countdown. Hidden when there is no campaign. */
export function SaleBanner({ promotion = activePromotion }: SaleBannerProps) {
  if (!promotion) return null;

  return (
    <UntilExpiry endsAt={promotion.endsAt}>
      <section
        aria-labelledby="promo-title"
        className="relative overflow-hidden border-y border-gold/60 bg-ink text-white"
      >
        {/* Soft gold glow behind the copy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 right-0 size-[300px] rounded-full bg-gold/10 blur-3xl sm:size-[520px]"
        />
        <Container className="relative grid items-center gap-10 py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-16">
          <Reveal className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-card border border-gold/70 shadow-gold-glow md:aspect-[4/5] md:max-w-none">
            <Image
              src={promotion.image.src}
              alt={promotion.image.alt}
              fill
              sizes="(min-width: 1200px) 460px, (min-width: 768px) 40vw, 320px"
              className="object-cover"
            />
          </Reveal>

          <Reveal
            delay={120}
            className="flex flex-col items-center gap-5 text-center md:items-start md:text-left"
          >
            <p className="font-caps text-[13px] tracking-[0.32em] text-gold-light uppercase">
              {promotion.eyebrow}
            </p>
            <h2 id="promo-title" className="flex flex-col gap-1">
              <span className="font-display text-[42px]/[1.05] sm:text-[56px]/[1.05]">
                {promotion.title}
              </span>{' '}
              <span className="font-script text-[40px]/[1.1] text-gold-light sm:text-[50px]/[1.1]">
                {promotion.highlight}
              </span>
            </h2>
            <p className="max-w-md text-[18px] text-white/85">{promotion.description}</p>
            <Countdown endsAt={promotion.endsAt} />
            <ButtonLink href={promotion.cta.href} variant="gold" withArrow className="mt-2">
              {promotion.cta.label}
            </ButtonLink>
          </Reveal>
        </Container>
      </section>
    </UntilExpiry>
  );
}
