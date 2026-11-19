import Image from 'next/image';
import { FaInstagram } from 'react-icons/fa6';

import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { instagram } from '@/config/instagram';
import { cn } from '@/lib/utils/cn';

/** Six-tile Instagram grid (3 × 2 on phones, one row on desktop) linking out to the profile. */
export function InstagramGallery() {
  const { handle, profileUrl, posts } = instagram;

  return (
    <section aria-labelledby="instagram-title" className="bg-ivory py-16 lg:py-20">
      <Container>
        <Reveal className="flex flex-col items-center gap-3">
          <SectionHeading
            id="instagram-title"
            title="Follow Us on Instagram"
            subtitle="New drops, styling ideas and behind-the-scenes — every week."
          />
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-caps text-[15px] tracking-[0.2em] text-gold-dark underline-offset-4 hover:underline"
          >
            {handle}
            <span className="sr-only"> on Instagram (opens in a new tab)</span>
          </a>
        </Reveal>

        <ul className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          {posts.map((post, i) => (
            <Reveal as="li" key={post.id} delay={i * 70}>
              <a
                href={post.href ?? profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-xl border border-gold/50 bg-sand"
              >
                <Image
                  src={post.image.src}
                  alt=""
                  fill
                  sizes="(min-width: 1200px) 190px, (min-width: 1024px) 16vw, 32vw"
                  className="object-cover transition-transform duration-500 ease-elegant group-hover:scale-110"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center bg-ink/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <FaInstagram className="size-8 text-white" />
                </span>
                <span className="sr-only">
                  Instagram post: {post.image.alt} (opens in a new tab)
                </span>
              </a>
            </Reveal>
          ))}
        </ul>

        <div className="mt-10 flex justify-center">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants(), 'gap-2.5')}
          >
            <FaInstagram aria-hidden className="size-[18px]" />
            Follow {handle}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </Container>
    </section>
  );
}
