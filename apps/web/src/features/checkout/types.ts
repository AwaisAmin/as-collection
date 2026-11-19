import type { VariantSnapshot } from '@/features/catalog/types';

import type { CheckoutField } from './schemas';

export type CheckoutState =
  | { status: 'idle' }
  | {
      status: 'error';
      message?: string;
      fieldErrors: Partial<Record<CheckoutField, string>>;
      /** Present when prices/stock changed — the client syncs its cart with these. */
      snapshots?: VariantSnapshot[];
      at: number;
    }
  | { status: 'success'; orderNumber: string; accessKey: string };

export const initialCheckoutState: CheckoutState = { status: 'idle' };
