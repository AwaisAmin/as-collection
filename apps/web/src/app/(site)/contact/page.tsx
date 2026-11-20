import { Clock, Mail, MessageCircle, Phone, Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { ContactForm } from '@/features/contact/components/contact-form';
import { faqsFor } from '@/features/contact/content/faqs';
import { getStoreSettings } from '@/features/content/services/store-content';
import type { StoreSettings } from '@/features/content/types';

export async function generateMetadata(): Promise<Metadata> {
  const { profile, contact } = await getStoreSettings();
  return {
    title: 'Contact Us',
    description: `Contact ${profile.name} — call or WhatsApp ${contact.phone} or email ${contact.email}.`,
    alternates: { canonical: '/contact' },
  };
}

const channelsFor = ({
  phone,
  phoneHref,
  whatsappHref,
  email,
  emailHref,
  hours,
}: StoreSettings['contact']) =>
  [
    { icon: MessageCircle, title: 'WhatsApp', value: phone, href: whatsappHref, external: true },
    { icon: Phone, title: 'Call us', value: phone, href: phoneHref, external: false },
    { icon: Mail, title: 'Email', value: email, href: emailHref, external: false },
    { icon: Clock, title: 'Hours', value: hours, href: undefined, external: false },
  ] as const;

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const channels = channelsFor(settings.contact);
  const faqs = faqsFor(settings);
  // FAQ structured data (eligible for rich results).
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="Contact Us"
        subtitle="We'd love to hear from you — orders, sizing, returns or anything else."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Contact Us' }]}
      />

      <Container className="flex flex-col gap-16 py-12">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map(({ icon: Icon, title, value, href, external }) => {
            const body = (
              <>
                <span className="flex size-12 items-center justify-center rounded-full border border-gold bg-cream">
                  <Icon aria-hidden size={21} className="text-gold-dark" />
                </span>
                <span className="font-display text-[19px] text-ink">{title}</span>
                <span className="text-[16px] wrap-break-word text-muted">{value}</span>
              </>
            );
            const cls =
              'flex h-full flex-col items-center gap-2 rounded-card border border-gold/60 bg-ivory p-6 text-center transition-all';
            return (
              <li key={title}>
                {href ? (
                  <a
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={`${cls} hover:-translate-y-0.5 hover:border-gold hover:shadow-soft`}
                  >
                    {body}
                    {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <section aria-labelledby="contact-form-title" className="flex flex-col gap-6">
            <div id="contact-form-title">
              <SectionHeading title="Send us a message" align="left" />
            </div>
            <ContactForm />
          </section>

          <section aria-labelledby="faq-title" className="flex flex-col gap-6">
            <div id="faq-title">
              <SectionHeading title="FAQs" align="left" />
            </div>
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-gold/60 bg-ivory open:border-gold"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-[17px] text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus
                      aria-hidden
                      size={18}
                      className="shrink-0 text-gold-dark transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-[17px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
    </main>
  );
}
