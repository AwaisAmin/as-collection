'use client';

import { createContext, type ReactNode, useContext } from 'react';

import { defaultMenus, defaultSettings } from '../lib/content-mappers';
import type { StoreContent } from '../types';

const StoreContentContext = createContext<StoreContent>({
  settings: defaultSettings,
  menus: defaultMenus,
  promotion: null,
});

/** Settings and menus for client components (navigation, WhatsApp button, checkout). */
export function StoreContentProvider({
  value,
  children,
}: {
  value: StoreContent;
  children: ReactNode;
}) {
  return <StoreContentContext value={value}>{children}</StoreContentContext>;
}

export const useStoreContent = () => useContext(StoreContentContext);
export const useStoreSettings = () => useContext(StoreContentContext).settings;
