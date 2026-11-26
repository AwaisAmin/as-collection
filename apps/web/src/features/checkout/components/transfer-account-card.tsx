'use client';

import { CopyButton } from '@/components/ui/copy-button';
import { transferAccounts as defaultAccounts, type TransferChannel } from '@/config/payments';
import { useStoreSettings } from '@/features/content/components/store-content-provider';
import { formatPrice } from '@/lib/utils/format';

/** "Send Rs X to this JazzCash account" with the store's details (checkout and order pages). */
export function TransferAccountCard({
  channel,
  total,
}: {
  channel: TransferChannel;
  total: number;
}) {
  // The store's accounts (admin settings); a channel it hasn't set up keeps the bundled entry.
  const account = useStoreSettings().transferAccounts[channel] ?? defaultAccounts[channel];

  return (
    <div className="rounded-xl border border-gold bg-ivory p-4 text-left">
      <p className="mb-3 text-[16px] text-text">
        Send <span className="font-bold">{formatPrice(total)}</span> to this {account.label}{' '}
        account:
      </p>
      <dl className="flex flex-col gap-2 font-body text-[16px]">
        {account.fields.map((f) => (
          <div key={f.label} className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted">{f.label}</dt>
            <dd className="flex items-center gap-2 font-bold text-ink">
              <span className="break-all">{f.value}</span>
              <CopyButton value={f.value} label={f.label} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
