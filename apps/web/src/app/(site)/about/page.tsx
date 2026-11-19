import type { Metadata } from 'next';
import Image from 'next/image';

import { LotusEmblem } from '@/components/ornaments/lotus-emblem';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { SectionHeading } from '@/components/ui/section-heading';
import { images } from '@/config/assets';
import { siteConfig } from '@/config/site';
import { brandStory, brandValues } from '@/features/home/content/brand-story';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'AS Collection Hub brings you elegant unstitched & stitched dresses and premium makeup — curated for every occasion, delivered across Pakistan.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main id="main-content" className="flex-1">
      {/* Intro */}
      <section aria-labelledby="about-title" className="border-b border-gold/50 bg-sand">
        <Container className="grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <LotusEmblem className="h-[64px] w-[80px]" />
            <h1 id="about-title" className="font-display text-[40px]/[1.1] sm:text-[52px]/[1.1]">
              {brandStory.title}
            </h1>
            <p className="font-caps text-[14px] tracking-[0.35em] uppercase">
              {siteConfig.tagline}
            </p>
            <p className="font-script text-[34px] leading-tight">{brandStory.script}</p>
            <p className="max-w-xl text-[19px] leading-relaxed text-text">{brandStory.intro}</p>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-card border border-gold shadow-soft">
            <Image
              src={images.heroModel.src}
              alt={images.heroModel.alt}
              fill
              sizes="(min-width: 1024px) 448px, 90vw"
              className="object-cover object-[60%_20%]"
              preload
            />
          </div>
        </Container>
      </section>

      {/* Values */}
      <section aria-labelledby="values-title" className="py-16">
        <Container>
          <div id="values-title">
            <SectionHeading title="What we stand for" />
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {brandValues.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex flex-col items-center gap-3 rounded-card border border-gold/60 bg-ivory p-6 text-center"
              >
                <span className="flex size-14 items-center justify-center rounded-full border border-gold bg-cream">
                  <Icon aria-hidden size={24} className="text-gold-dark" />
                </span>
                <h3 className="font-display text-[20px]">{title}</h3>
                <OrnamentDivider width={70} />
                <p className="text-[17px] leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Collections */}
      <section aria-labelledby="collections-title" className="bg-ink py-16 text-white">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-4">
            <h2 id="collections-title" className="font-display text-[36px]/[1.15]">
              Unstitched, stitched &amp; makeup — all in one place
            </h2>
            <p className="text-[18px] leading-relaxed text-white/80">
              Explore rich zari and tilla work on lawn, chiffon and organza, ready-to-wear kurtas
              and frocks in true-to-size fits, and long-wear makeup in shades made for Pakistani
              skin tones.
            </p>
            <div className="mt-2">
              <ButtonLink href="/shop" variant="gold" withArrow>
                Shop the collection
              </ButtonLink>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[images.unstitched, images.stitched, images.makeup].map((img) => (
              <div
                key={img.src}
                className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gold/60"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 1024px) 200px, 30vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-16">
        <Container className="flex flex-col items-center gap-5 text-center">
          <SectionHeading
            title="We’re here to help"
            subtitle="Questions about sizing, fabric or your order? Our team is a message away."
          />
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/contact" withArrow>
              Contact us
            </ButtonLink>
            <ButtonLink href="/track-order" variant="ghost" className="border-[1.5px] border-gold">
              Track your order
            </ButtonLink>
          </div>
        </Container>
      </section>
    </main>
  );
}
