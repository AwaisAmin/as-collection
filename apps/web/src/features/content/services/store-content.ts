import 'server-only';

import type { MenuDto, PromotionDto, PublicSettingsDto } from '@as/contracts';
import type { Route } from 'next';
import { cacheLife, cacheTag } from 'next/cache';

import { serverEnv } from '@/config/env.server';
import { activePromotion, type Promotion } from '@/config/promotions';
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
  if (serverEnv.MOCK_API) {
    return { settings: defaultSettings, menus: defaultMenus, promotion: activePromotion };
  }

  const [settings, main, shopMega, footer, promo] = await Promise.all([
    safely('settings', () => apiRequest<PublicSettingsDto>('/content/settings')),
    safely('menu.main', () => apiFindOrNull<MenuDto>('/content/menus/main')),
    safely('menu.shop-mega', () => apiFindOrNull<MenuDto>('/content/menus/shop-mega')),
    safely('menu.footer', () => apiFindOrNull<MenuDto>('/content/menus/footer')),
    safely('promotion', () =>
      apiRequest<{ promotion: PromotionDto | null }>('/content/promotions/active'),
    ),
  ]);
  return {
    settings: toStoreSettings(settings),
    menus: { main: toMainNav(main), shopMega: toShopMega(shopMega), footer: toFooterNav(footer) },
    promotion: toPromotion(promo?.promotion ?? null),
  };
}

const toPromotion = (dto: PromotionDto | null): Promotion | null =>
  dto ? { ...dto, cta: { label: dto.cta.label, href: dto.cta.href as Route } } : null;

/** Just the settings (server components). */
export const getStoreSettings = async () => (await getStoreContent()).settings;
