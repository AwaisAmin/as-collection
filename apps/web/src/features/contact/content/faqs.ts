import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/utils/format';

/** Frequently asked questions (kept in sync with policies via siteConfig). */
export const faqs: readonly { q: string; a: string }[] = [
  {
    q: 'How long does delivery take?',
    a: 'Lahore, Karachi and Islamabad: 2–3 working days. Other cities: 3–5 working days. We call or message to confirm your order before dispatch.',
  },
  {
    q: 'How much is delivery?',
    a: `Delivery is free on orders above ${formatPrice(siteConfig.freeShippingThreshold)}. Below that, a flat ${formatPrice(siteConfig.shippingFee)} applies.`,
  },
  {
    q: 'Which payment methods do you accept?',
    a: 'Cash on Delivery nationwide, plus bank transfer, JazzCash and Easypaisa (upload your payment screenshot at checkout).',
  },
  {
    q: 'Can I return or exchange an item?',
    a: `Yes — within ${siteConfig.returnWindowDays} days of delivery, if unused and in original packaging with tags. Makeup can be returned only if sealed.`,
  },
  {
    q: 'How do I track my order?',
    a: 'Use the Track Order page with your order number and the mobile number used at checkout, or sign in to see all your orders.',
  },
  {
    q: 'Do unstitched suits include all pieces?',
    a: 'Each product page lists exactly what’s included (e.g. 3-piece: shirt, dupatta, trouser) along with fabric and measurements.',
  },
];
