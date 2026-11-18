import Image from 'next/image';

import { LotusEmblem } from '@/components/ornaments/lotus-emblem';
import { ButtonLink } from '@/components/ui/button';
import { images } from '@/config/assets';

import { type HeroContent, heroContent } from '../../content/hero';
import { HeroBackdrop } from './hero-backdrop';
import { ScriptTagline } from './script-tagline';

const decorClass = 'pointer-events-none absolute select-none';

/** Thin gold rule that fades out toward its outer end. */
function GoldRule({ direction }: { direction: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className={
        direction === 'left'
          ? 'block h-px w-16 bg-linear-to-r from-transparent to-gold sm:w-[150px] lg:w-[120px] xl:w-[165px]'
          : 'block h-px w-16 bg-linear-to-l from-transparent to-gold sm:w-[150px] lg:w-[120px] xl:w-[165px]'
      }
    />
  );
}

interface HeroProps {
  content?: HeroContent;
}

export function Hero({ content = heroContent }: HeroProps) {
  const model = images[content.image];
  const [taglineA, taglineB] = content.taglineParts;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden lg:h-[484px] xl:h-[500px]"
    >
      <HeroBackdrop />

      {/* Model — top on mobile, left half on desktop */}
      <div className="relative h-[380px] sm:h-[460px] lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[53%]">
        <Image
          src={model.src}
          alt={model.alt}
          fill
          preload
          sizes="(min-width: 1024px) 53vw, 100vw"
          className="mask-b-from-80% object-cover object-top lg:mask-r-from-82% lg:mask-b-from-100%"
        />
      </div>

      {/* Decorative florals over the open background (desktop only — on mobile the photo is full width).
          The left vase of flowers is part of the hero photo itself. */}
      <Image
        src={images.flowersRight.src}
        alt=""
        aria-hidden
        width={420}
        height={380}
        className={`${decorClass} -top-4 -right-6 hidden w-[190px] lg:block xl:w-[210px]`}
      />
      <Image
        src={images.palmLeaf.src}
        alt=""
        aria-hidden
        width={300}
        height={300}
        className={`${decorClass} -right-4 -bottom-4 hidden w-[120px] lg:block xl:w-[135px]`}
      />

      {/* Copy */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-8 pb-12 text-center lg:absolute lg:inset-y-0 lg:right-0 lg:w-[56%] lg:justify-center lg:pt-0 lg:pb-6 xl:w-[60%]">
        <div className="flex animate-fade-up items-end gap-3 sm:gap-4">
          <span className="mb-[30px] lg:mb-[34px]">
            <GoldRule direction="left" />
          </span>
          <LotusEmblem className="h-[72px] w-[90px] lg:h-[92px] lg:w-[112px]" />
          <span className="mb-[30px] lg:mb-[34px]">
            <GoldRule direction="right" />
          </span>
        </div>

        <h1
          id="hero-title"
          className="mt-3 animate-fade-up font-display text-[clamp(30px,10.6vw,40px)]/[1.05] tracking-[-0.02em] whitespace-nowrap text-ink [animation-delay:80ms] sm:text-[60px]/[1.05] lg:text-[66px]/[1.05] xl:text-[80px]/[1.05]"
        >
          {content.title}
        </h1>

        <p className="mt-3 flex animate-fade-up items-center gap-[1.1em] font-caps text-[clamp(10px,3.4vw,13px)] tracking-[0.35em] whitespace-nowrap text-ink uppercase [animation-delay:160ms] sm:text-[18px] lg:text-[19px] xl:text-[22px]">
          <span className="-mr-[0.35em]">{taglineA}</span>
          <span aria-hidden className="size-[0.32em] rounded-full bg-ink" />
          <span className="sr-only">,</span>
          <span className="-mr-[0.35em]">{taglineB}</span>
        </p>

        <ScriptTagline
          text={content.script}
          className="mt-3 animate-fade-up text-[clamp(21px,7.2vw,27px)] leading-[1.2] whitespace-nowrap [animation-delay:240ms] sm:text-[40px] lg:text-[40px] xl:text-[46px]"
        />

        <ButtonLink
          href={content.cta.href}
          size="lg"
          withArrow
          className="mt-6 animate-fade-up px-8 text-[22px] [animation-delay:320ms] sm:px-10 sm:text-[26px]"
        >
          {content.cta.label}
        </ButtonLink>
      </div>
    </section>
  );
}
