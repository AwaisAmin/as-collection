import type { StoreSettings } from '@/features/content/types';
import { formatPrice } from '@/lib/utils/format';

/** Store policies shown on product pages, from the store's delivery and contact settings. */
export const shippingPolicyFor = ({ shipping, contact }: StoreSettings) => ({
  delivery: [
    `Free delivery on orders above ${formatPrice(shipping.freeShippingThreshold)}; ${formatPrice(shipping.shippingFee)} flat fee below that.`,
    'Lahore, Karachi & Islamabad: 2–3 working days. Other cities: 3–5 working days.',
    'Cash on Delivery available nationwide. Bank transfer, JazzCash and Easypaisa also accepted.',
  ],
  returns: [
    `Easy returns & exchange within ${shipping.returnWindowDays} days of delivery.`,
    'Items must be unused, unwashed and in original packaging with tags attached.',
    'Makeup can be returned only if sealed and unopened, for hygiene reasons.',
    `To start a return, call ${contact.phone} or email ${contact.email}.`,
  ],
});
