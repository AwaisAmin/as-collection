import { GoldLeafBranch } from '@/components/ornaments/gold-leaf-branch';
import { Container } from '@/components/ui/container';

import { NewsletterForm } from './newsletter-form';

/** Black newsletter band with gold leaf ornaments at both edges and a gold rule below. */
export function NewsletterSection() {
  return (
    <section
      aria-labelledby="newsletter-title"
      className="relative isolate overflow-hidden border-b-[1.5px] border-gold bg-ink text-white"
    >
      <GoldLeafBranch className="pointer-events-none absolute bottom-1 -left-4 -z-10 hidden h-[118px] w-[110px] md:block" />
      <GoldLeafBranch
        flip
        className="pointer-events-none absolute -right-4 bottom-1 -z-10 hidden h-[118px] w-[110px] md:block"
      />

      <Container className="flex flex-col items-center gap-6 py-10 lg:min-h-[135px] lg:flex-row lg:justify-center lg:gap-20 lg:py-0">
        <div className="text-center">
          <h2
            id="newsletter-title"
            className="font-display text-[32px]/[1.15] sm:text-[40px]/[1.15]"
          >
            Join Our Newsletter
          </h2>
          <p className="mt-1 font-body text-[18px] sm:text-[20px]">
            Get the latest updates, offers and more!
          </p>
        </div>
        <NewsletterForm className="mb-4 lg:mb-0" />
      </Container>
    </section>
  );
}
