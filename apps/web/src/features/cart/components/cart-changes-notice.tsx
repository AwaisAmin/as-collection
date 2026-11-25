import { Info } from 'lucide-react';

import { formatPrice } from '@/lib/utils/format';

import type { CartChange } from '../types';

function describe(change: CartChange): string {
  switch (change.kind) {
    case 'price':
      return `${change.name}: price ${change.to < change.from ? 'dropped' : 'changed'} from ${formatPrice(change.from)} to ${formatPrice(change.to)}.`;
    case 'quantity':
      return `${change.name}: only ${change.to} left in stock — quantity updated.`;
    case 'unavailable':
      return `${change.name} is now sold out.`;
  }
}

/** "We updated your cart…" after the server check found price or stock changes. */
export function CartChangesNotice({ changes }: { changes: readonly CartChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-gold bg-sand px-4 py-3">
      <Info aria-hidden size={20} className="mt-0.5 shrink-0 text-gold-dark" />
      <div className="text-[16px] text-text">
        <p className="font-bold">We updated your cart with the latest prices and stock:</p>
        <ul className="mt-1 list-disc pl-5">
          {changes.map((c, i) => (
            <li key={i}>{describe(c)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
