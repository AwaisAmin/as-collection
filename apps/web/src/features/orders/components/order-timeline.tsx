import {
  Check,
  CircleX,
  Package,
  PackageCheck,
  PhoneCall,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';

import type { Order } from '../types';

const steps = [
  { status: 'pending', label: 'Order placed', hint: 'We received your order', icon: ShoppingBag },
  {
    status: 'confirmed',
    label: 'Confirmed',
    hint: 'We call or message to confirm',
    icon: PhoneCall,
  },
  { status: 'processing', label: 'Being prepared', hint: 'Packed with care', icon: Package },
  { status: 'shipped', label: 'Shipped', hint: 'With the courier', icon: Truck },
  { status: 'delivered', label: 'Delivered', hint: 'Enjoy your purchase!', icon: PackageCheck },
] as const;

/** Vertical progress timeline for an order's fulfilment status. */
export function OrderTimeline({ status }: { status: Order['status'] }) {
  if (status === 'cancelled') {
    return (
      <p className="flex items-center gap-3 rounded-xl border border-gold bg-sand px-4 py-3 text-[17px]">
        <CircleX aria-hidden className="size-6 text-gold-dark" />
        This order was cancelled. Contact us if you have any questions.
      </p>
    );
  }

  const current = steps.findIndex((s) => s.status === status);

  return (
    <ol aria-label="Order progress" className="flex flex-col">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = done ? Check : step.icon;
        return (
          <li key={step.status} className="relative flex gap-4 pb-7 last:pb-0">
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-11 bottom-1 left-[21px] w-0.5',
                  i < current ? 'bg-gold' : 'bg-gold/25',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-full border-2',
                done && 'border-gold bg-gold text-ink',
                active && 'border-ink bg-ink text-white shadow-gold-glow',
                !done && !active && 'border-gold/40 bg-ivory text-muted/60',
              )}
            >
              <Icon aria-hidden size={19} />
            </span>
            <div className="pt-1.5">
              <p
                className={cn(
                  'font-display text-[18px]',
                  !done && !active ? 'text-muted' : 'text-ink',
                )}
              >
                {step.label}
                {active ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold-gradient px-2 py-0.5 align-middle font-body text-[12px] font-bold text-ink">
                    <Sparkles aria-hidden size={11} /> Current
                  </span>
                ) : null}
              </p>
              <p className="text-[15px] text-muted">{step.hint}</p>
              <span className="sr-only">
                {done ? '(completed)' : active ? '(current step)' : '(upcoming)'}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
