import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/shared/legal-page';
import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: `Terms for shopping at ${siteConfig.name}: orders, payment, delivery, returns and exchanges.`,
  alternates: { canonical: '/terms' },
};

const { email, phone } = siteConfig.contact;

/* Template terms — have them reviewed for your business before launch. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      lastUpdated="19 November 2026"
      intro={
        <p>
          By placing an order with {siteConfig.name} you agree to these terms. Please read them
          carefully — they explain how orders, payments, delivery and returns work.
        </p>
      }
      sections={[
        {
          id: 'orders',
          title: 'Orders & confirmation',
          body: (
            <>
              <p>
                After you place an order we may call or message you to confirm it before dispatch.
                We may cancel an order if we can’t reach you, if an item becomes unavailable, or if
                we suspect fraud — any amount you paid will be refunded in full.
              </p>
              <p>Product colours may vary slightly due to lighting and screen settings.</p>
            </>
          ),
        },
        {
          id: 'pricing-payment',
          title: 'Pricing & payment',
          body: (
            <ul>
              <li>All prices are in Pakistani Rupees (PKR) and include applicable taxes.</li>
              <li>Cash on Delivery: pay the courier the exact order total on delivery.</li>
              <li>
                Bank transfer / JazzCash / Easypaisa: your order is confirmed after we verify the
                payment screenshot you upload at checkout.
              </li>
            </ul>
          ),
        },
        {
          id: 'delivery',
          title: 'Delivery',
          body: (
            <ul>
              <li>
                Free delivery on orders above {formatPrice(siteConfig.freeShippingThreshold)}; a
                flat {formatPrice(siteConfig.shippingFee)} applies below that.
              </li>
              <li>Usual delivery time: 2–5 working days depending on your city.</li>
              <li>
                Please check your parcel on delivery and contact us within 48 hours about any
                damage.
              </li>
            </ul>
          ),
        },
        {
          id: 'returns',
          title: 'Returns & exchange',
          body: (
            <ul>
              <li>
                Returns and exchanges are accepted within {siteConfig.returnWindowDays} days of
                delivery.
              </li>
              <li>Items must be unused, unwashed and in original packaging with tags attached.</li>
              <li>Makeup can be returned only if sealed and unopened, for hygiene reasons.</li>
              <li>
                Approved refunds are made to your bank account or mobile wallet within 7 working
                days.
              </li>
            </ul>
          ),
        },
        {
          id: 'accounts',
          title: 'Accounts',
          body: (
            <p>
              You’re responsible for keeping access to your mobile number and Google account secure.
              We may suspend accounts used for fraud or abuse.
            </p>
          ),
        },
        {
          id: 'privacy',
          title: 'Privacy',
          body: (
            <p>
              Our{' '}
              <Link
                href="/privacy-policy"
                className="font-semibold text-gold-dark underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              explains how we handle your personal information.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact',
          body: (
            <p>
              For any questions about these terms, contact us at {email} or {phone}.
            </p>
          ),
        },
      ]}
    />
  );
}
