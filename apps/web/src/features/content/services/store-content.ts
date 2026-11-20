import 'server-only';

import type { MenuDto, PublicSettingsDto } from '@as/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverEnv } from '@/config/env.server';
import { apiFindOrNull, apiRequest } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import {
  defaultMenus,
  defaultSettings,
  toFooterNav,
  toMainNav,
  toShopMega,
  toStoreSettings,
} from '../lib/content-mappers';
import type { StoreContent } from '../types';

/** Cache tags revalidated by the API when staff save settings or content. */
export const SETTINGS_TAG = 'settings';
export const CONTENT_TAG = 'content';

/** A failed read falls back to the bundled defaults (the page still renders) and is reported. */
async function safely<T>(what: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    reportError(error, { action: `content.${what}` });
    return null;
  }
}

/**
 * Store settings and menus for every page (header, footer, top bar, checkout). Cached for
 * minutes and refreshed at once when the API reports an edit (revalidation webhook).
 */
export async function getStoreContent(): Promise<StoreContent> {
  'use cache';
  cacheLife('minutes');
  cacheTag(SETTINGS_TAG, CONTENT_TAG);
  if (serverEnv.MOCK_API) return { settings: defaultSettings, menus: defaultMenus };

  const [settings, main, shopMega, footer] = await Promise.all([
    safely('settings', () => apiRequest<PublicSettingsDto>('/content/settings')),
    safely('menu.main', () => apiFindOrNull<MenuDto>('/content/menus/main')),
    safely('menu.shop-mega', () => apiFindOrNull<MenuDto>('/content/menus/shop-mega')),
    safely('menu.footer', () => apiFindOrNull<MenuDto>('/content/menus/footer')),
  ]);
  return {
    settings: toStoreSettings(settings),
    menus: { main: toMainNav(main), shopMega: toShopMega(shopMega), footer: toFooterNav(footer) },
  };
}

/** Just the settings (server components). */
export const getStoreSettings = async () => (await getStoreContent()).settings;
