import { RotateCcw, ShieldCheck, Truck } from 'lucide-react';

import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/utils/format';

const perks = [
  {
    icon: Truck,
    title: 'Free delivery',
    text: `On orders above ${formatPrice(siteConfig.freeShippingThreshold)}`,
  },
  { icon: ShieldCheck, title: 'Cash on delivery', text: 'Pay when your order arrives' },
  {
    icon: RotateCcw,
    title: 'Easy returns',
    text: `${siteConfig.returnWindowDays}-day returns & exchange`,
  },
] as const;

export function DeliveryPerks() {
  return (
    <ul className="grid gap-3 rounded-card border border-gold/60 bg-sand/60 p-4 sm:grid-cols-3 lg:grid-cols-1">
      {perks.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold bg-ivory">
            <Icon aria-hidden size={19} className="text-ink" strokeWidth={1.7} />
          </span>
          <span className="font-body leading-tight">
            <span className="block text-[16px] font-bold text-ink">{title}</span>
            <span className="block text-[15px] text-muted">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
