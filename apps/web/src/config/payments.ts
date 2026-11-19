/**
 * ⚠️ PLACEHOLDER payment accounts — replace with the store's real details before launch
 * (later these come from the admin panel). Shown on checkout for manual transfers.
 */
export const transferChannels = ['bank', 'jazzcash', 'easypaisa'] as const;
export type TransferChannel = (typeof transferChannels)[number];

export interface TransferAccount {
  channel: TransferChannel;
  label: string;
  /** Rows shown to the shopper, each with a copy button. */
  fields: readonly { label: string; value: string }[];
}

export const transferAccounts: Record<TransferChannel, TransferAccount> = {
  bank: {
    channel: 'bank',
    label: 'Bank transfer',
    fields: [
      { label: 'Bank', value: 'Meezan Bank' },
      { label: 'Account title', value: 'AS Collection Hub' },
      { label: 'Account number', value: '0000-0000000000' },
      { label: 'IBAN', value: 'PK00MEZN0000000000000000' },
    ],
  },
  jazzcash: {
    channel: 'jazzcash',
    label: 'JazzCash',
    fields: [
      { label: 'Account title', value: 'AS Collection Hub' },
      { label: 'JazzCash number', value: '0328-9485741' },
    ],
  },
  easypaisa: {
    channel: 'easypaisa',
    label: 'Easypaisa',
    fields: [
      { label: 'Account title', value: 'AS Collection Hub' },
      { label: 'Easypaisa number', value: '0328-9485741' },
    ],
  },
};
