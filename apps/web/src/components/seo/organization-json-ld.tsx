import { siteConfig } from '@/config/site';
import { socialLinks } from '@/config/socials';

/**
 * schema.org Organization/OnlineStore data so search engines can show the brand's
 * contact details and social profiles. `<` is escaped to prevent script injection.
 */
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: new URL('/images/gold-leaf.svg', siteConfig.url).toString(),
    description: siteConfig.description,
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.phoneE164,
    sameAs: socialLinks.map((s) => s.href),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      telephone: siteConfig.contact.phoneE164,
      email: siteConfig.contact.email,
      areaServed: 'PK',
      availableLanguage: ['en', 'ur'],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
