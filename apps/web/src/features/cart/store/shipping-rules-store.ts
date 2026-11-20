'use client';

import { create } from 'zustand';

import { siteConfig } from '@/config/site';

import type { ShippingRules } from '../lib/cart-totals';

interface ShippingRulesState {
  rules: ShippingRules;
  setRules: (rules: ShippingRules) => void;
}

/**
 * The store's delivery fee and free-delivery threshold, as the API charges them. Seeded on every
 * page from the server (`ShippingRulesSync`) and corrected by checkout if they changed meanwhile,
 * so the total a shopper confirms is the total the API computes.
 */
export const useShippingRulesStore = create<ShippingRulesState>()((set) => ({
  rules: {
    shippingFee: siteConfig.shippingFee,
    freeShippingThreshold: siteConfig.freeShippingThreshold,
  },
  setRules: (rules) => {
    set((state) =>
      state.rules.shippingFee === rules.shippingFee &&
      state.rules.freeShippingThreshold === rules.freeShippingThreshold
        ? state
        : { rules },
    );
  },
}));
