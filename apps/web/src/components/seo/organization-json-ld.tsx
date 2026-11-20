import { siteConfig } from '@/config/site';
import { getStoreSettings } from '@/features/content/services/store-content';

/**
 * schema.org Organization/OnlineStore data so search engines can show the brand's
 * contact details and social profiles. `<` is escaped to prevent script injection.
 */
export async function OrganizationJsonLd() {
  const { profile, contact, socials } = await getStoreSettings();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: profile.name,
    url: siteConfig.url,
    logo: new URL('/images/brand/logo-512.png', siteConfig.url).toString(),
    description: profile.description,
    email: contact.email,
    telephone: contact.phoneE164,
    sameAs: socials.map((s) => s.href),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      telephone: contact.phoneE164,
      email: contact.email,
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
