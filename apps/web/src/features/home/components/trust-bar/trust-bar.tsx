import { Fragment } from 'react';

import { Container } from '@/components/ui/container';
import { VerticalDivider } from '@/components/ui/vertical-divider';

import { type TrustFeature, trustFeatures } from '../../content/trust-features';

function TrustItem({ icon: Icon, lines }: TrustFeature) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left lg:gap-5">
      <Icon aria-hidden className="size-9 shrink-0 text-ink lg:size-11" />
      <p className="font-body text-[16px]/[1.2] text-text sm:text-[17px]/[1.2] lg:text-[19px]/[1.2]">
        <span className="block">{lines[0]}</span>
        <span className="block">{lines[1]}</span>
      </p>
    </div>
  );
}

interface TrustBarProps {
  features?: readonly TrustFeature[];
}

/** Shipping / COD / support / returns reassurance band. Row on desktop, 2×2 below `lg`. */
export function TrustBar({ features = trustFeatures }: TrustBarProps) {
  return (
    <section aria-labelledby="trust-title" className="bg-sand">
      <h2 id="trust-title" className="sr-only">
        Why shop with us
      </h2>
      <Container className="py-6 lg:flex lg:h-[92px] lg:items-center lg:py-0">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-8 lg:flex lg:w-full lg:items-center lg:justify-between lg:gap-0 lg:px-6 xl:px-8">
          {features.map((feature, i) => (
            <Fragment key={feature.id}>
              {i > 0 ? (
                <li aria-hidden className="hidden h-[52px] lg:flex">
                  <VerticalDivider tone="dark" />
                </li>
              ) : null}
              <li className="flex justify-center lg:block">
                <TrustItem {...feature} />
              </li>
            </Fragment>
          ))}
        </ul>
      </Container>
    </section>
  );
}
