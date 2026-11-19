'use client';

import { Banknote, Landmark } from 'lucide-react';
import { useId } from 'react';

import { CopyButton } from '@/components/ui/copy-button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { transferAccounts, type TransferChannel, transferChannels } from '@/config/payments';
import type { PaymentMethod } from '@/features/orders/types';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';

import type { CheckoutField } from '../schemas';
import { ScreenshotUpload } from './screenshot-upload';

interface PaymentSectionProps {
  method: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  channel: TransferChannel;
  onChannelChange: (channel: TransferChannel) => void;
  total: number;
  errors: Partial<Record<CheckoutField, string>>;
  clearError: (field: CheckoutField) => void;
}

const methodCards = [
  {
    value: 'cod',
    icon: Banknote,
    title: 'Cash on Delivery',
    text: 'Pay in cash when your order arrives.',
  },
  {
    value: 'bank_transfer',
    icon: Landmark,
    title: 'Bank / JazzCash / Easypaisa',
    text: 'Transfer now and upload the payment screenshot.',
  },
] as const;

export function PaymentSection({
  method,
  onMethodChange,
  channel,
  onChannelChange,
  total,
  errors,
  clearError,
}: PaymentSectionProps) {
  const base = useId();
  const account = transferAccounts[channel];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="radiogroup"
        aria-label="Payment method"
        aria-describedby={errors.paymentMethod ? `${base}-method-error` : undefined}
        className="grid gap-3 sm:grid-cols-2"
      >
        {methodCards.map(({ value, icon: Icon, title, text }) => {
          const checked = method === value;
          return (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-2xl border-[1.5px] p-4 transition-colors',
                checked
                  ? 'border-ink bg-ivory shadow-soft'
                  : 'border-gold/60 bg-ivory/60 hover:border-gold',
                'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold-dark',
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={value}
                checked={checked}
                onChange={() => {
                  onMethodChange(value);
                  clearError('paymentMethod');
                }}
                className="mt-1 size-4 shrink-0 accent-ink"
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-display text-[17px] text-ink">
                  <Icon aria-hidden size={18} className="text-gold-dark" />
                  {title}
                </span>
                <span className="mt-1 block text-[15px] text-muted">{text}</span>
              </span>
            </label>
          );
        })}
      </div>
      {errors.paymentMethod ? (
        <p
          id={`${base}-method-error`}
          className="-mt-2 px-1 text-[15px] font-semibold text-gold-dark"
        >
          {errors.paymentMethod}
        </p>
      ) : null}

      {method === 'bank_transfer' ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-gold/60 bg-sand/50 p-4 sm:p-5">
          <fieldset>
            <legend className="mb-3 px-1 font-display text-[16px]">Send payment via</legend>
            <div className="flex flex-wrap gap-2">
              {transferChannels.map((c) => (
                <label
                  key={c}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-4 py-1.5 font-body text-[16px] font-bold transition-colors',
                    channel === c
                      ? 'border-gold bg-ink text-white'
                      : 'border-gold/60 bg-ivory text-text hover:border-gold',
                    'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold-dark',
                  )}
                >
                  <input
                    type="radio"
                    name="transferChannel"
                    value={c}
                    checked={channel === c}
                    onChange={() => {
                      onChannelChange(c);
                      clearError('transferChannel');
                    }}
                    className="sr-only"
                  />
                  {transferAccounts[c].label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-xl border border-gold bg-ivory p-4">
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

          <FormField
            id={`${base}-ref`}
            label="Transaction ID"
            hint="Helps us match your payment faster."
            error={errors.transactionRef}
          >
            {(a11y) => (
              <Input
                {...a11y}
                name="transactionRef"
                maxLength={40}
                autoComplete="off"
                onChange={() => clearError('transactionRef')}
              />
            )}
          </FormField>

          <FormField
            id={`${base}-screenshot`}
            label="Payment screenshot"
            required
            error={errors.screenshot}
          >
            {(a11y) => (
              <ScreenshotUpload
                {...a11y}
                name="screenshot"
                onChange={() => clearError('screenshot')}
              />
            )}
          </FormField>

          <p className="text-[14px] text-muted">
            Your order is confirmed once we verify the payment (usually within a few hours).
          </p>
        </div>
      ) : null}
    </div>
  );
}
