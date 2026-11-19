import Link from 'next/link';
import { Fragment } from 'react';

import { Container } from '@/components/ui/container';
import { SocialLinks } from '@/components/ui/social-links';
import { VerticalDivider } from '@/components/ui/vertical-divider';
import { footerNav } from '@/config/navigation';
import { siteConfig } from '@/config/site';

export function Footer() {
  return (
    <footer className="bg-ink font-body text-[17px] text-white">
      <Container className="flex flex-col items-center gap-5 py-8 text-center lg:h-26 lg:flex-row lg:justify-between lg:gap-4 lg:py-0 lg:text-left xl:gap-6">
        <p className="lg:shrink-0 lg:whitespace-nowrap">
          © {siteConfig.copyrightYear} {siteConfig.name}. All Rights Reserved.
        </p>

        <VerticalDivider className="hidden h-8.5 self-center lg:block" />

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:flex-nowrap lg:gap-x-4 lg:whitespace-nowrap xl:gap-x-5">
            {footerNav.map((link, i) => (
              <Fragment key={link.href}>
                {i > 0 ? (
                  <li aria-hidden className="hidden h-5.5 sm:flex">
                    <VerticalDivider />
                  </li>
                ) : null}
                <li>
                  <Link href={link.href} className="transition-colors duration-200 hover:text-gold">
                    {link.label}
                  </Link>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>

        <VerticalDivider className="hidden h-8.5 self-center lg:block" />

        <SocialLinks variant="circle" />
      </Container>
    </footer>
  );
}
