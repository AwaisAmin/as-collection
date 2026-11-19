import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/utils/format';

/** Store policies shown on product pages (single source until a CMS/admin manages them). */
export const shippingPolicy = {
  delivery: [
    `Free delivery on orders above ${formatPrice(siteConfig.freeShippingThreshold)}; ${formatPrice(siteConfig.shippingFee)} flat fee below that.`,
    'Lahore, Karachi & Islamabad: 2–3 working days. Other cities: 3–5 working days.',
    'Cash on Delivery available nationwide. Bank transfer, JazzCash and Easypaisa also accepted.',
  ],
  returns: [
    `Easy returns & exchange within ${siteConfig.returnWindowDays} days of delivery.`,
    'Items must be unused, unwashed and in original packaging with tags attached.',
    'Makeup can be returned only if sealed and unopened, for hygiene reasons.',
    `To start a return, call ${siteConfig.contact.phone} or email ${siteConfig.contact.email}.`,
  ],
};
