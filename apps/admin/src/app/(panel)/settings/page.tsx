import type { AdminSettingDto, StoreSettingKey } from '@as/contracts';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import {
  AnnouncementsSetting,
  ContactSetting,
  PaymentAccountsSetting,
  ProfileSetting,
  SettingsGroup,
  ShippingSetting,
  SocialsSetting,
  TrustFeaturesSetting,
} from '@/features/settings/components/setting-forms';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'settings.write')) {
    return <Alert tone="error">Your role does not include store settings.</Alert>;
  }
  const list = await apiRequest<AdminSettingDto[]>('/admin/settings', { token }).catch(() => null);
  if (!list) {
    return (
      <Alert tone="error">Settings could not be loaded right now. Refresh to try again.</Alert>
    );
  }
  const byKey = new Map(list.map((s) => [s.key, s]));
  const get = <K extends StoreSettingKey>(key: K) =>
    (byKey.get(key) ?? {
      key,
      label: key,
      value: null,
      valid: false,
      updatedAt: null,
      updatedBy: null,
    }) as AdminSettingDto<K>;
  const card = <K extends StoreSettingKey>(key: K) => ({ setting: get(key), canWrite: true });
  // Each card restarts from the stored value after its own save.
  const version = (key: StoreSettingKey) => `${key}@${get(key).updatedAt ?? 'new'}`;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-[22px] font-semibold">Settings</h1>
        <p className="text-[14px] text-muted">
          Store-wide details. Each card saves on its own and shows in the shop within a moment.
        </p>
      </div>

      <SettingsGroup title="Store">
        <ProfileSetting key={version('store.profile')} {...card('store.profile')} />
        <ContactSetting key={version('store.contact')} {...card('store.contact')} />
        <SocialsSetting key={version('store.socials')} {...card('store.socials')} />
      </SettingsGroup>

      <SettingsGroup title="Orders">
        <ShippingSetting key={version('shipping')} {...card('shipping')} />
        <PaymentAccountsSetting
          key={version('payments.transfer-accounts')}
          {...card('payments.transfer-accounts')}
        />
      </SettingsGroup>

      <SettingsGroup title="Messages">
        <AnnouncementsSetting key={version('announcements')} {...card('announcements')} />
        <TrustFeaturesSetting
          key={version('home.trust-features')}
          {...card('home.trust-features')}
        />
      </SettingsGroup>
    </div>
  );
}
