import { type TabItem, Tabs } from '@/components/ui/tabs';
import type { Product } from '@/features/catalog/types';
import type { StoreSettings } from '@/features/content/types';

import { shippingPolicyFor } from '../content/policies';

function PolicyList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-[18px] text-text marker:text-gold">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Server-rendered tab content passed into the client Tabs shell. */
export function ProductDetailsTabs({
  product,
  settings,
}: {
  product: Product;
  settings: StoreSettings;
}) {
  const shippingPolicy = shippingPolicyFor(settings);
  const items: TabItem[] = [
    {
      id: 'description',
      label: 'Description',
      content: (
        <div className="flex max-w-3xl flex-col gap-4 text-[18px] leading-relaxed text-text">
          {product.description.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ),
    },
    {
      id: 'details',
      label: 'Details',
      content: (
        <dl className="grid max-w-3xl overflow-hidden rounded-xl border border-gold/50 font-body text-[17px]">
          {product.details.map((d) => (
            <div
              key={d.label}
              className="grid grid-cols-[minmax(110px,30%)_1fr] border-b border-gold/40 last:border-b-0 even:bg-cream"
            >
              <dt className="px-4 py-3 font-bold text-ink">{d.label}</dt>
              <dd className="px-4 py-3 text-text">{d.value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      id: 'shipping',
      label: 'Shipping & Returns',
      content: (
        <div className="grid max-w-3xl gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 font-display text-[20px]">Delivery</h3>
            <PolicyList items={shippingPolicy.delivery} />
          </div>
          <div>
            <h3 className="mb-3 font-display text-[20px]">Returns & exchange</h3>
            <PolicyList items={shippingPolicy.returns} />
          </div>
        </div>
      ),
    },
  ];

  return <Tabs items={items} label="Product information" />;
}
