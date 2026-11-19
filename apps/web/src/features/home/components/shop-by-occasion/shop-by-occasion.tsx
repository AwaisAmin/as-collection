import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { type Occasion, occasionHref, occasions as allOccasions } from '@/config/occasions';

function OccasionCard({ occasion }: { occasion: Occasion }) {
  return (
    <Link
      href={occasionHref(occasion.slug)}
      className="group relative block aspect-[3/4] overflow-hidden rounded-card border border-gold/70 bg-sand shadow-soft transition-shadow duration-300 hover:shadow-card-hover"
    >
      <Image
        src={occasion.image.src}
        alt=""
        fill
        sizes="(min-width: 1200px) 280px, (min-width: 1024px) 23vw, 48vw"
        className="object-cover transition-transform duration-700 ease-elegant group-hover:scale-105"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1.5 p-4 text-center text-white sm:p-6">
        <h3 className="font-display text-[24px]/tight sm:text-[30px]/tight">{occasion.name}</h3>
        <p className="hidden text-[16px]/snug text-white/90 sm:block">{occasion.blurb}</p>
        <span className="mt-1 inline-flex items-center gap-1.5 font-caps text-[11px] tracking-[0.2em] text-gold-light uppercase sm:text-[12px]">
          Shop now
          <ArrowRight
            aria-hidden
            size={14}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

interface ShopByOccasionProps {
  occasions?: readonly Occasion[];
}

/** Four occasion tiles linking to the shop's `occasion` filter. */
export function ShopByOccasion({ occasions = allOccasions }: ShopByOccasionProps) {
  return (
    <section aria-labelledby="occasion-title" className="bg-cream py-16 lg:py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="occasion-title"
            title="Shop by Occasion"
            subtitle="From everyday lawn to wedding-season showstoppers."
          />
        </Reveal>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {occasions.map((occasion, i) => (
            <Reveal as="li" key={occasion.slug} delay={i * 100}>
              <OccasionCard occasion={occasion} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
