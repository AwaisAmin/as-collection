import type { Metadata } from 'next';

import { LegalPage } from '@/components/shared/legal-page';
import { siteConfig } from '@/config/site';
import { getStoreSettings } from '@/features/content/services/store-content';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} collects, uses and protects your personal information.`,
  alternates: { canonical: '/privacy-policy' },
};

/* Template policy — have it reviewed for your business before launch. */
export default async function PrivacyPolicyPage() {
  const { email, phone } = (await getStoreSettings()).contact;
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="19 November 2026"
      intro={
        <p>
          {siteConfig.name} (“we”, “us”) respects your privacy. This policy explains what
          information we collect when you shop with us, why we collect it and the choices you have.
        </p>
      }
      sections={[
        {
          id: 'information-we-collect',
          title: 'Information we collect',
          body: (
            <ul>
              <li>Contact details: name, mobile number and (optionally) email.</li>
              <li>Delivery details: city, address and postal code.</li>
              <li>
                Order details: items purchased, payment method and, for transfers, the payment
                screenshot you upload.
              </li>
              <li>
                Account details: your verified mobile number or Google account email when you sign
                in.
              </li>
              <li>
                Basic technical data such as device and browser type, used to keep the site secure
                and working.
              </li>
            </ul>
          ),
        },
        {
          id: 'how-we-use-it',
          title: 'How we use your information',
          body: (
            <ul>
              <li>
                To process, confirm, deliver and support your orders (including calls or WhatsApp
                messages about them).
              </li>
              <li>To send one-time login codes and keep your account secure.</li>
              <li>To verify payments and prevent fraud.</li>
              <li>
                To send newsletters and offers — only if you subscribe, and you can unsubscribe at
                any time.
              </li>
            </ul>
          ),
        },
        {
          id: 'sharing',
          title: 'Sharing with third parties',
          body: (
            <p>
              We never sell your data. We share only what is necessary with trusted partners who
              help us run the store — such as courier companies (name, phone and address for
              delivery), messaging providers (to send login codes) and hosting providers.
            </p>
          ),
        },
        {
          id: 'cookies',
          title: 'Cookies & local storage',
          body: (
            <p>
              We use an essential cookie to keep you signed in, and your browser’s storage to
              remember your cart and wishlist. These are required for the store to work and are not
              used for advertising.
            </p>
          ),
        },
        {
          id: 'security-retention',
          title: 'Security & retention',
          body: (
            <p>
              We protect your information with industry-standard safeguards, including encrypted
              connections and hashed login codes. We keep order records only as long as needed for
              delivery, returns, accounting and legal obligations.
            </p>
          ),
        },
        {
          id: 'your-rights',
          title: 'Your choices & rights',
          body: (
            <p>
              You can view and update your profile and addresses in My Account, unsubscribe from
              emails at any time, or ask us to delete your account by contacting {email} or {phone}.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact us',
          body: (
            <p>
              Questions about this policy? Email {email} or call/WhatsApp {phone}.
            </p>
          ),
        },
      ]}
    />
  );
}
