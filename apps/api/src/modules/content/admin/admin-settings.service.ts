import type { AdminSettingDto } from '@as/contracts';
import { Injectable } from '@nestjs/common';

import { assertFresh, conflict, notFound } from '../../../common/admin-write.js';
import { ValidationFailedException } from '../../../common/http/problem-details.js';
import { formatIssuePath } from '../../../common/http/validation.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { CacheService } from '../../../redis/cache.service.js';
import { StorefrontRevalidator } from '../../../storefront/storefront-revalidator.js';
import { type AuditActor, AuditService } from '../../audit/audit.service.js';
import { SETTINGS_CACHE } from '../../orders/store-settings.service.js';
import { isPublicSettingKey, PUBLIC_SETTINGS, type PublicSettingKey } from '../content.schemas.js';

/** Editable settings: today every one of them is also public (see `PUBLIC_SETTINGS`). */
const SETTING_SCHEMAS = PUBLIC_SETTINGS;
type SettingKey = PublicSettingKey;
const isSettingKey = isPublicSettingKey;

/** What each key is, for the admin panel's settings screen. */
export const SETTING_LABELS: Record<SettingKey, string> = {
  'store.profile': 'Store name, tagline and description',
  'store.contact': 'Phone, WhatsApp, email and opening hours',
  'store.socials': 'Social media links',
  shipping: 'Delivery fee, free-delivery threshold and return window',
  'payments.transfer-accounts': 'Bank, JazzCash and Easypaisa account details',
  'home.trust-features': 'Trust strip on the home page',
  announcements: 'Announcement bar messages',
};

const settingNotFound = () => notFound('SETTING_NOT_FOUND', 'Unknown setting.');

/**
 * Store settings, each validated by its own schema (the same one the storefront and checkout
 * read with) and stored as parsed. Saving refreshes the settings cache, so checkout picks up a
 * new delivery fee at once. Edits are optimistic-locked and audited with before/after values.
 */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly storefront: StorefrontRevalidator,
  ) {}

  async list(): Promise<AdminSettingDto[]> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: Object.keys(SETTING_SCHEMAS) } },
      select: {
        key: true,
        value: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return (Object.keys(SETTING_SCHEMAS) as SettingKey[]).map((key) => {
      const row = byKey.get(key);
      return {
        key,
        label: SETTING_LABELS[key],
        // Shapes are those of PUBLIC_SETTINGS (`settingsMatchContract` checks them at compile time).
        value: (row?.value ?? null) as AdminSettingDto['value'],
        /** False: stored value fails its schema, so the storefront ignores it. */
        valid: row ? SETTING_SCHEMAS[key].safeParse(row.value).success : false,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    });
  }

  async get(key: string): Promise<AdminSettingDto> {
    if (!isSettingKey(key)) throw settingNotFound();
    const found = (await this.list()).find((s) => s.key === key);
    if (!found) throw settingNotFound();
    return found;
  }

  async put(key: string, input: { value: unknown; updatedAt: Date | null }, actor: AuditActor) {
    if (!isSettingKey(key)) throw settingNotFound();
    const parsed = SETTING_SCHEMAS[key].safeParse(input.value);
    if (!parsed.success) {
      throw new ValidationFailedException(
        parsed.error.issues.map((issue) => ({
          path: `value.${formatIssuePath(issue.path)}`,
          message: issue.message,
        })),
      );
    }
    const value = parsed.data as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ updated_at: Date; value: unknown }[]>`
        SELECT updated_at, value FROM settings WHERE key = ${key} FOR UPDATE`;
      const before = locked[0];
      if (before) {
        assertFresh(before.updated_at, input.updatedAt ?? new Date(0), 'setting');
      } else if (input.updatedAt) {
        throw conflict('STALE_UPDATE', 'This setting was removed since you opened it.');
      }
      await tx.setting.upsert({
        where: { key },
        create: { key, value, updatedByStaffId: actor.staffId },
        update: { value, updatedByStaffId: actor.staffId, updatedAt: new Date() },
      });
      await this.audit.record(
        actor,
        {
          action: 'setting.update',
          entityType: 'setting',
          entityId: null,
          changes: { key, before: before?.value ?? null, after: value },
        },
        tx,
      );
    });
    // Public settings, the announcement bar and checkout's delivery fee all live here.
    await this.cache.invalidate(SETTINGS_CACHE);
    this.storefront.revalidate('settings');
    return this.get(key);
  }
}
