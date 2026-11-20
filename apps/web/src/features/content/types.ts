import type { AnnouncementIcon } from '@as/contracts';

import type { MegaMenuColumn, NavItem, NavLink } from '@/config/navigation';
import type { TransferAccount, TransferChannel } from '@/config/payments';
import type { SocialLink } from '@/config/socials';

/** Store settings the storefront shows (admin-editable; config files are the offline fallback). */
export interface StoreSettings {
  profile: { name: string; shortName: string; tagline: string; description: string };
  contact: {
    phone: string;
    phoneE164: string;
    phoneHref: string;
    whatsappHref: string;
    hours: string;
    email: string;
    emailHref: string;
  };
  socials: readonly SocialLink[];
  shipping: { shippingFee: number; freeShippingThreshold: number; returnWindowDays: number };
  /** Manual transfer accounts shown at checkout, in display order. */
  transferAccounts: Partial<Record<TransferChannel, TransferAccount>>;
  /** True while the account details are still placeholders. */
  paymentsPlaceholder: boolean;
  announcements: readonly { id: string; icon: AnnouncementIcon; text: string; href?: string }[];
  trustFeatures: readonly { id: string; lines: readonly string[]; href?: string }[];
}

export interface StoreMenus {
  main: readonly NavItem[];
  shopMega: {
    columns: readonly MegaMenuColumn[];
    occasions: readonly NavLink[];
    highlights: readonly NavLink[];
  };
  footer: readonly NavLink[];
}

export interface StoreContent {
  settings: StoreSettings;
  menus: StoreMenus;
}
