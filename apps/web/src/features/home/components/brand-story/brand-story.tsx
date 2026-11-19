import Image from 'next/image';

import { Reveal } from '@/components/motion/reveal';
import { LotusEmblem } from '@/components/ornaments/lotus-emblem';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

import { brandStory, brandValues } from '../../content/brand-story';

/** Short brand story with three values and a link to the full About page. */
export function BrandStory() {
  return (
    <section aria-labelledby="story-title" className="border-y border-gold/50 bg-sand">
      <Container className="grid items-center gap-10 py-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
        <Reveal className="relative mx-auto aspect-4/5 w-full max-w-95 md:max-w-none">
          {/* Offset gold frame behind the photo. */}
          <div
            aria-hidden
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-card border border-gold"
          />
          <div className="relative size-full overflow-hidden rounded-card border border-gold/70 shadow-soft">
            <Image
              src="/images/brand/story.jpg"
              alt="Close-up of gold floral embroidery on black fabric"
              fill
              sizes="(min-width: 1200px) 460px, (min-width: 768px) 40vw, 380px"
              className="object-cover"
            />
          </div>
        </Reveal>

        <Reveal
          delay={120}
          className="flex flex-col items-center gap-5 text-center md:items-start md:text-left"
        >
          <LotusEmblem className="h-13 w-16.5" />
          <h2
            id="story-title"
            className="font-display text-[38px]/[1.1] text-ink sm:text-[46px]/[1.1]"
          >
            {brandStory.title}
          </h2>
          <p className="font-script text-[32px]/tight text-ink">{brandStory.script}</p>
          <p className="max-w-xl text-[18px] leading-relaxed text-text">{brandStory.intro}</p>

          <ul className="grid w-full grid-cols-3 gap-3 pt-2 sm:gap-4">
            {brandValues.slice(0, 3).map(({ icon: Icon, title }) => (
              <li
                key={title}
                className="flex flex-col items-center gap-2 md:flex-row md:items-center md:gap-3"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold bg-ivory">
                  <Icon aria-hidden size={20} className="text-gold-dark" />
                </span>
                <span className="font-display text-[15px]/tight text-ink sm:text-[17px]/tight">
                  {title}
                </span>
              </li>
            ))}
          </ul>

          <ButtonLink href="/about" withArrow className="mt-2">
            Read our story
          </ButtonLink>
        </Reveal>
      </Container>
    </section>
  );
}
