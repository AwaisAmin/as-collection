import { Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';

import { PagePlaceholder } from '@/components/shared/page-placeholder';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Contact ${siteConfig.name} — call ${siteConfig.contact.phone} or email ${siteConfig.contact.email}.`,
};

const linkClasses =
  'inline-flex items-center gap-3 font-display text-[20px] text-text transition-colors duration-200 hover:text-gold';

export default function ContactPage() {
  const { phone, phoneHref, email, emailHref } = siteConfig.contact;

  return (
    <PagePlaceholder
      title="Contact Us"
      description="We'd love to hear from you. Reach us by phone or email."
    >
      <address className="flex flex-col items-center gap-3 not-italic">
        <a href={phoneHref} className={linkClasses}>
          <Phone aria-hidden className="size-5 text-gold-dark" />
          <span className="sr-only">Phone: </span>
          {phone}
        </a>
        <a href={emailHref} className={linkClasses}>
          <Mail aria-hidden className="size-5 text-gold-dark" />
          <span className="sr-only">Email: </span>
          {email}
        </a>
      </address>
    </PagePlaceholder>
  );
}
