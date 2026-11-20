'use client';

import { useEffect } from 'react';

import type { ShippingRules } from '../lib/cart-totals';
import { useShippingRulesStore } from '../store/shipping-rules-store';

/** Hands the server's delivery rules to the cart (renders nothing). */
export function ShippingRulesSync({ rules }: { rules: ShippingRules }) {
  const setRules = useShippingRulesStore((s) => s.setRules);
  useEffect(() => {
    setRules(rules);
  }, [rules, setRules]);
  return null;
}
