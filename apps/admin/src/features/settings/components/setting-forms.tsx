'use client';

import type { AdminSettingDto, StoreSettingValues } from '@as/contracts';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { minorToRupees, rupeesToMinor } from '@/features/products/form-model';

import { contactValue, whatsappNumber } from '../contact';
import { SettingCard } from './setting-card';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

/** Up / down / remove for a row of a list setting. */
function RowTools<T>({
  list,
  index,
  onChange,
  name,
}: {
  list: T[];
  index: number;
  onChange: (list: T[]) => void;
  name: string;
}) {
  const move = (by: -1 | 1) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item !== undefined) next.splice(index + by, 0, item);
    onChange(next);
  };
  return (
    <div className="flex shrink-0">
      <button
        type="button"
        className={iconButton}
        disabled={index === 0}
        onClick={() => move(-1)}
        title="Move up"
      >
        <ArrowUp aria-hidden size={15} />
        <span className="sr-only">Move {name} up</span>
      </button>
      <button
        type="button"
        className={iconButton}
        disabled={index === list.length - 1}
        onClick={() => move(1)}
        title="Move down"
      >
        <ArrowDown aria-hidden size={15} />
        <span className="sr-only">Move {name} down</span>
      </button>
      <button
        type="button"
        className={`${iconButton} hover:text-danger`}
        onClick={() => onChange(list.filter((_, i) => i !== index))}
        title="Remove"
      >
        <Trash2 aria-hidden size={15} />
        <span className="sr-only">Remove {name}</span>
      </button>
    </div>
  );
}

const errorAt = (errors: Record<string, string>, prefix: string) =>
  Object.entries(errors).find(([path]) => path === prefix || path.startsWith(`${prefix}.`))?.[1];

function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  max,
  required,
  rows,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  max: number;
  required?: boolean;
  rows?: number;
  inputMode?: 'decimal' | 'numeric' | 'tel' | 'email';
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {(control) =>
        rows ? (
          <Textarea
            {...control}
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={max}
          />
        ) : (
          <Input
            {...control}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={max}
            inputMode={inputMode}
          />
        )
      }
    </Field>
  );
}

type Props<K extends keyof StoreSettingValues> = {
  setting: AdminSettingDto<K>;
  canWrite: boolean;
};

// ─── Store details ───

export function ProfileSetting({ setting, canWrite }: Props<'store.profile'>) {
  const v = setting.value;
  return (
    <SettingCard
      setting={setting}
      title="Store details"
      description="The name and words used across the shop, in search results and when links are shared."
      initial={{
        name: v?.name ?? '',
        shortName: v?.shortName ?? '',
        tagline: v?.tagline ?? '',
        description: v?.description ?? '',
      }}
      toValue={(d) =>
        d.name.trim()
          ? {
              value: {
                name: d.name.trim(),
                shortName: d.shortName.trim() || d.name.trim(),
                tagline: d.tagline.trim(),
                description: d.description.trim(),
                locale: v?.locale ?? 'en_PK',
                currency: 'PKR',
              },
            }
          : { errors: { name: 'Enter the store name.' } }
      }
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Store name"
              value={value.name}
              onChange={(name) => onChange({ ...value, name })}
              error={errors.name}
              max={120}
              required
            />
            <TextInput
              label="Short name"
              hint="Where space is tight (phone home screen)."
              value={value.shortName}
              onChange={(shortName) => onChange({ ...value, shortName })}
              error={errors.shortName}
              max={60}
            />
          </div>
          <TextInput
            label="Tagline"
            value={value.tagline}
            onChange={(tagline) => onChange({ ...value, tagline })}
            error={errors.tagline}
            max={160}
          />
          <TextInput
            label="Description"
            hint="One or two sentences for search engines and shared links."
            value={value.description}
            onChange={(description) => onChange({ ...value, description })}
            error={errors.description}
            max={400}
            rows={3}
          />
        </>
      )}
    </SettingCard>
  );
}

// ─── Contact ───

export function ContactSetting({ setting, canWrite }: Props<'store.contact'>) {
  const v = setting.value;
  return (
    <SettingCard
      setting={setting}
      title="Contact"
      description="The call and WhatsApp buttons, the footer and the contact page use these. Links are made for you."
      initial={{
        phone: v?.phone ?? '',
        whatsapp: v ? whatsappNumber(v.whatsappHref) : '',
        email: v?.email ?? '',
        hours: v?.hours ?? '',
      }}
      toValue={(d) => {
        const result = contactValue(d);
        return 'value' in result ? result : { errors: { [result.field]: result.message } };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Phone"
              hint="A Pakistani mobile, e.g. 0328-9485741."
              value={value.phone}
              onChange={(phone) => onChange({ ...value, phone })}
              error={errors.phone ?? errorAt(errors, 'phoneE164')}
              max={30}
              inputMode="tel"
              required
            />
            <TextInput
              label="WhatsApp"
              hint="Leave empty to use the phone number."
              value={value.whatsapp}
              onChange={(whatsapp) => onChange({ ...value, whatsapp })}
              error={errors.whatsapp ?? errorAt(errors, 'whatsappHref')}
              max={30}
              inputMode="tel"
            />
            <TextInput
              label="Email"
              value={value.email}
              onChange={(email) => onChange({ ...value, email })}
              error={errors.email}
              max={254}
              inputMode="email"
              required
            />
            <TextInput
              label="Opening hours"
              hint="e.g. Mon–Sat, 10:00 am – 8:00 pm"
              value={value.hours}
              onChange={(hours) => onChange({ ...value, hours })}
              error={errors.hours}
              max={120}
            />
          </div>
        </>
      )}
    </SettingCard>
  );
}

// ─── Social links ───

const PLATFORMS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
} as const;
type Platform = keyof typeof PLATFORMS;

export function SocialsSetting({ setting, canWrite }: Props<'store.socials'>) {
  return (
    <SettingCard
      setting={setting}
      title="Social links"
      description="Shown as icons in the footer. The shop has icons for these four networks."
      initial={(setting.value ?? []).map((s) => ({ ...s }))}
      toValue={(list) => {
        const errors: Record<string, string> = {};
        list.forEach((s, i) => {
          if (!/^https:\/\/\S+$/.test(s.href.trim())) {
            errors[`${String(i)}.href`] = 'Use the full https:// address.';
          }
        });
        return Object.keys(errors).length
          ? { errors }
          : {
              value: list.map((s) => ({
                platform: s.platform,
                label: PLATFORMS[s.platform as Platform] ?? s.label,
                href: s.href.trim(),
              })),
            };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => {
        const used = new Set(value.map((s) => s.platform));
        const free = (Object.keys(PLATFORMS) as Platform[]).filter((p) => !used.has(p));
        return (
          <>
            {value.length ? (
              <ul className="flex flex-col gap-2">
                {value.map((s, index) => (
                  <li
                    key={s.platform}
                    aria-label={PLATFORMS[s.platform as Platform] ?? s.platform}
                    className="flex items-start gap-2"
                  >
                    <span className="w-24 shrink-0 pt-2.5 text-[14px] font-medium">
                      {PLATFORMS[s.platform as Platform] ?? s.platform}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={s.href}
                        onChange={(event) =>
                          onChange(
                            value.map((x, i) =>
                              i === index ? { ...x, href: event.target.value } : x,
                            ),
                          )
                        }
                        placeholder="https://…"
                        aria-label={`${PLATFORMS[s.platform as Platform] ?? s.platform} address`}
                        aria-invalid={errorAt(errors, `${String(index)}.href`) ? true : undefined}
                        maxLength={500}
                      />
                      {errorAt(errors, `${String(index)}.href`) ? (
                        <p className="text-danger mt-1 text-[13px]">
                          {errorAt(errors, `${String(index)}.href`)}
                        </p>
                      ) : null}
                    </div>
                    <RowTools
                      list={value}
                      index={index}
                      onChange={onChange}
                      name={PLATFORMS[s.platform as Platform] ?? s.platform}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">No social links.</p>
            )}
            {free.length ? (
              <Select
                value=""
                onChange={(event) => {
                  const platform = event.target.value as Platform;
                  if (platform) {
                    onChange([...value, { platform, label: PLATFORMS[platform], href: '' }]);
                  }
                }}
                aria-label="Add a social network"
                className="sm:max-w-xs"
              >
                <option value="">Add a network…</option>
                {free.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORMS[p]}
                  </option>
                ))}
              </Select>
            ) : null}
          </>
        );
      }}
    </SettingCard>
  );
}

// ─── Delivery ───

export function ShippingSetting({ setting, canWrite }: Props<'shipping'>) {
  const v = setting.value;
  return (
    <SettingCard
      setting={setting}
      title="Delivery and returns"
      description="Checkout charges this fee straight away after saving; orders already placed keep theirs."
      initial={{
        fee: minorToRupees(v?.flatFeeMinor ?? 0),
        freeOver: minorToRupees(v?.freeShippingThresholdMinor ?? 0),
        returnDays: String(v?.returnWindowDays ?? 7),
      }}
      toValue={(d) => {
        const errors: Record<string, string> = {};
        const fee = rupeesToMinor(d.fee || '0');
        const freeOver = rupeesToMinor(d.freeOver || '0');
        const days = Number(d.returnDays);
        if (fee === null || Number.isNaN(fee)) errors.fee = 'Enter the fee in rupees (0 for free).';
        if (freeOver === null || Number.isNaN(freeOver)) {
          errors.freeOver = 'Enter an amount in rupees (0: never free).';
        }
        if (!Number.isInteger(days) || days < 0 || days > 90) {
          errors.returnDays = 'Enter 0 to 90 days.';
        }
        return Object.keys(errors).length || fee === null || freeOver === null
          ? { errors }
          : {
              value: {
                flatFeeMinor: fee,
                freeShippingThresholdMinor: freeOver,
                returnWindowDays: days,
              },
            };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput
            label="Delivery fee (Rs)"
            value={value.fee}
            onChange={(fee) => onChange({ ...value, fee })}
            error={errors.fee ?? errors.flatFeeMinor}
            max={12}
            inputMode="decimal"
            required
          />
          <TextInput
            label="Free delivery over (Rs)"
            hint="Items total. 0: delivery is never free."
            value={value.freeOver}
            onChange={(freeOver) => onChange({ ...value, freeOver })}
            error={errors.freeOver ?? errors.freeShippingThresholdMinor}
            max={12}
            inputMode="decimal"
            required
          />
          <TextInput
            label="Return window (days)"
            hint="Shown in the returns policy."
            value={value.returnDays}
            onChange={(returnDays) => onChange({ ...value, returnDays })}
            error={errors.returnDays ?? errors.returnWindowDays}
            max={2}
            inputMode="numeric"
            required
          />
        </div>
      )}
    </SettingCard>
  );
}

// ─── Payment accounts ───

const CHANNELS = {
  bank: 'Bank transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
} as const;
type Channel = keyof typeof CHANNELS;
type Account = { enabled: boolean; label: string; fields: { label: string; value: string }[] };

export function PaymentAccountsSetting({ setting, canWrite }: Props<'payments.transfer-accounts'>) {
  const v = setting.value;
  const initial = {
    real: !(v?.isPlaceholder ?? true),
    accounts: Object.fromEntries(
      (Object.keys(CHANNELS) as Channel[]).map((channel) => {
        const account = v?.transferAccounts[channel];
        return [
          channel,
          {
            enabled: Boolean(account),
            label: account?.label ?? CHANNELS[channel],
            fields: account?.fields.map((f) => ({ ...f })) ?? [
              { label: 'Account title', value: '' },
              { label: channel === 'bank' ? 'Account number' : 'Number', value: '' },
            ],
          },
        ];
      }),
    ) as Record<Channel, Account>,
  };
  return (
    <SettingCard
      setting={setting}
      title="Payment accounts"
      description="Where customers send bank and wallet transfers. Shown at checkout and on their order page."
      initial={initial}
      toValue={(d) => {
        const errors: Record<string, string> = {};
        const accounts: StoreSettingValues['payments.transfer-accounts']['transferAccounts'] = {};
        for (const channel of Object.keys(CHANNELS) as Channel[]) {
          const a = d.accounts[channel];
          if (!a.enabled) continue;
          const fields = a.fields
            .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
            .filter((f) => f.label || f.value);
          if (!fields.length || fields.some((f) => !f.label || !f.value)) {
            errors[`transferAccounts.${channel}`] = 'Fill in every line (or remove empty ones).';
          }
          accounts[channel] = { channel, label: a.label.trim() || CHANNELS[channel], fields };
        }
        if (!Object.keys(accounts).length) errors.real = 'Turn on at least one way to pay.';
        return Object.keys(errors).length
          ? { errors }
          : { value: { isPlaceholder: !d.real, transferAccounts: accounts } };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => {
        const setAccount = (channel: Channel, change: Partial<Account>) =>
          onChange({
            ...value,
            accounts: { ...value.accounts, [channel]: { ...value.accounts[channel], ...change } },
          });
        return (
          <>
            {!value.real ? (
              <Alert tone="error">
                These are still the sample details, and the shop shows them to customers who pay by
                transfer. Enter the real accounts, then tick “These are the real accounts”.
              </Alert>
            ) : null}
            {(Object.keys(CHANNELS) as Channel[]).map((channel) => {
              const account = value.accounts[channel];
              const error = errorAt(errors, `transferAccounts.${channel}`);
              return (
                <div
                  key={channel}
                  role="group"
                  aria-label={CHANNELS[channel]}
                  className="border-line flex flex-col gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    label={`Accept ${CHANNELS[channel]}`}
                    checked={account.enabled}
                    onChange={(event) => setAccount(channel, { enabled: event.target.checked })}
                  />
                  {account.enabled ? (
                    <>
                      <ul className="flex flex-col gap-2">
                        {account.fields.map((f, index) => (
                          <li key={index} className="flex items-start gap-2">
                            {/* Name over value on phones, side by side from sm. */}
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[2fr_3fr]">
                              <Input
                                value={f.label}
                                onChange={(event) =>
                                  setAccount(channel, {
                                    fields: account.fields.map((x, i) =>
                                      i === index ? { ...x, label: event.target.value } : x,
                                    ),
                                  })
                                }
                                placeholder="e.g. IBAN"
                                aria-label={`${CHANNELS[channel]} line ${String(index + 1)} name`}
                                maxLength={60}
                              />
                              <Input
                                value={f.value}
                                onChange={(event) =>
                                  setAccount(channel, {
                                    fields: account.fields.map((x, i) =>
                                      i === index ? { ...x, value: event.target.value } : x,
                                    ),
                                  })
                                }
                                aria-label={`${CHANNELS[channel]} line ${String(index + 1)} value`}
                                maxLength={80}
                                className="font-mono"
                              />
                            </div>
                            <RowTools
                              list={account.fields}
                              index={index}
                              onChange={(fields) => setAccount(channel, { fields })}
                              name={`${CHANNELS[channel]} line ${String(index + 1)}`}
                            />
                          </li>
                        ))}
                      </ul>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={account.fields.length >= 8}
                          onClick={() =>
                            setAccount(channel, {
                              fields: [...account.fields, { label: '', value: '' }],
                            })
                          }
                        >
                          <Plus aria-hidden size={14} />
                          Add a line
                        </Button>
                      </div>
                    </>
                  ) : null}
                  {error ? <p className="text-danger text-[13px]">{error}</p> : null}
                </div>
              );
            })}
            <Checkbox
              label="These are the real accounts"
              hint="Only tick once every number above has been checked."
              checked={value.real}
              onChange={(event) => onChange({ ...value, real: event.target.checked })}
            />
            {errors.real ? <p className="text-danger text-[13px]">{errors.real}</p> : null}
          </>
        );
      }}
    </SettingCard>
  );
}

// ─── Announcement bar ───

const ANNOUNCEMENT_ICONS = {
  truck: 'Delivery truck',
  'shield-check': 'Shield (secure / COD)',
  headset: 'Headset (support)',
  gift: 'Gift',
  sparkles: 'Sparkles (new)',
  tag: 'Price tag (sale)',
} as const;
type AnnouncementIcon = keyof typeof ANNOUNCEMENT_ICONS;
type Announcement = StoreSettingValues['announcements'][number];

const nextAnnouncementId = (list: readonly { id: string }[]) => {
  let n = list.length + 1;
  while (list.some((a) => a.id === `message-${String(n)}`)) n += 1;
  return `message-${String(n)}`;
};

export function AnnouncementsSetting({ setting, canWrite }: Props<'announcements'>) {
  return (
    <SettingCard
      setting={setting}
      title="Announcement bar"
      description="Short messages at the very top of every page (up to 6, shown in turn)."
      initial={(setting.value ?? []).map((a) => ({ ...a, href: a.href ?? '' }))}
      toValue={(list) => {
        const errors: Record<string, string> = {};
        list.forEach((a, i) => {
          if (!a.text.trim()) errors[`${String(i)}.text`] = 'Write the message.';
        });
        return Object.keys(errors).length
          ? { errors }
          : {
              value: list.map((a): Announcement => ({
                id: a.id,
                icon: a.icon,
                text: a.text.trim(),
                ...(a.href.trim() ? { href: a.href.trim() } : {}),
              })),
            };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => (
        <>
          {value.length ? (
            <ol className="flex flex-col gap-2">
              {value.map((a, index) => {
                const set = (change: Partial<(typeof value)[number]>) =>
                  onChange(value.map((x, i) => (i === index ? { ...x, ...change } : x)));
                const textError = errorAt(errors, `${String(index)}.text`);
                const hrefError = errorAt(errors, `${String(index)}.href`);
                return (
                  <li
                    key={a.id}
                    aria-label={`Message ${String(index + 1)}`}
                    className="border-line flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
                  >
                    <Select
                      value={a.icon}
                      onChange={(event) => set({ icon: event.target.value as AnnouncementIcon })}
                      aria-label={`Message ${String(index + 1)} icon`}
                      className="sm:w-48"
                    >
                      {(Object.keys(ANNOUNCEMENT_ICONS) as AnnouncementIcon[]).map((icon) => (
                        <option key={icon} value={icon}>
                          {ANNOUNCEMENT_ICONS[icon]}
                        </option>
                      ))}
                    </Select>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Input
                        value={a.text}
                        onChange={(event) => set({ text: event.target.value })}
                        placeholder="Free delivery on orders above Rs 2,500"
                        aria-label={`Message ${String(index + 1)} text`}
                        aria-invalid={textError ? true : undefined}
                        maxLength={120}
                      />
                      <Input
                        value={a.href}
                        onChange={(event) => set({ href: event.target.value })}
                        placeholder="Link (optional): /shop?sale=1"
                        aria-label={`Message ${String(index + 1)} link`}
                        aria-invalid={hrefError ? true : undefined}
                        maxLength={500}
                      />
                      {textError || hrefError ? (
                        <p className="text-danger text-[13px]">{textError ?? hrefError}</p>
                      ) : null}
                    </div>
                    <RowTools
                      list={value}
                      index={index}
                      onChange={onChange}
                      name={`message ${String(index + 1)}`}
                    />
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[14px] text-muted">No messages: the bar is hidden.</p>
          )}
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={value.length >= 6}
              onClick={() =>
                onChange([
                  ...value,
                  { id: nextAnnouncementId(value), icon: 'sparkles', text: '', href: '' },
                ])
              }
            >
              <Plus aria-hidden size={15} />
              Add a message
            </Button>
          </div>
        </>
      )}
    </SettingCard>
  );
}

// ─── Trust bar ───

/** The shop picks each promise's icon from its id. */
const TRUST_ICONS = {
  shipping: 'Delivery truck',
  cod: 'Shield (cash on delivery)',
  support: 'Headset (support)',
  returns: 'Gift (returns)',
} as const;
type TrustIcon = keyof typeof TRUST_ICONS;

export function TrustFeaturesSetting({ setting, canWrite }: Props<'home.trust-features'>) {
  return (
    <SettingCard
      setting={setting}
      title="Trust bar"
      description="Promises shown on the home page, each with an icon and two short lines."
      initial={(setting.value ?? []).map((t) => ({
        id: t.id,
        first: t.lines[0] ?? '',
        second: t.lines[1] ?? '',
        href: t.href ?? '',
      }))}
      toValue={(list) => {
        const errors: Record<string, string> = {};
        list.forEach((t, i) => {
          if (!t.first.trim()) errors[`${String(i)}.lines`] = 'Write at least the first line.';
        });
        return Object.keys(errors).length
          ? { errors }
          : {
              value: list.map((t) => ({
                id: t.id,
                lines: [t.first.trim(), t.second.trim()].filter(Boolean),
                ...(t.href.trim() ? { href: t.href.trim() } : {}),
              })),
            };
      }}
      canWrite={canWrite}
    >
      {({ value, onChange, errors }) => {
        const used = new Set(value.map((t) => t.id));
        const free = (Object.keys(TRUST_ICONS) as TrustIcon[]).filter((i) => !used.has(i));
        return (
          <>
            {value.length ? (
              <ol className="flex flex-col gap-2">
                {value.map((t, index) => {
                  const set = (change: Partial<(typeof value)[number]>) =>
                    onChange(value.map((x, i) => (i === index ? { ...x, ...change } : x)));
                  const error =
                    errorAt(errors, `${String(index)}.lines`) ??
                    errorAt(errors, `${String(index)}.href`);
                  const name = TRUST_ICONS[t.id as TrustIcon] ?? t.id;
                  return (
                    <li
                      key={t.id}
                      aria-label={name}
                      className="border-line flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
                    >
                      <span className="pt-2.5 text-[14px] font-medium sm:w-48">{name}</span>
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={t.first}
                          onChange={(event) => set({ first: event.target.value })}
                          placeholder="Free Shipping"
                          aria-label={`${name} first line`}
                          maxLength={80}
                        />
                        <Input
                          value={t.second}
                          onChange={(event) => set({ second: event.target.value })}
                          placeholder="on Orders Above 2500"
                          aria-label={`${name} second line`}
                          maxLength={80}
                        />
                        <Input
                          value={t.href}
                          onChange={(event) => set({ href: event.target.value })}
                          placeholder="Link (optional): tel:+92… or /policies"
                          aria-label={`${name} link`}
                          maxLength={500}
                          className="sm:col-span-2"
                        />
                        {error ? (
                          <p className="text-danger text-[13px] sm:col-span-2">{error}</p>
                        ) : null}
                      </div>
                      <RowTools list={value} index={index} onChange={onChange} name={name} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-[14px] text-muted">No promises: the bar is empty.</p>
            )}
            {free.length ? (
              <Select
                value=""
                onChange={(event) => {
                  const id = event.target.value as TrustIcon;
                  if (id) onChange([...value, { id, first: '', second: '', href: '' }]);
                }}
                aria-label="Add a promise"
                className="sm:max-w-xs"
              >
                <option value="">Add a promise…</option>
                {free.map((id) => (
                  <option key={id} value={id}>
                    {TRUST_ICONS[id]}
                  </option>
                ))}
              </Select>
            ) : null}
          </>
        );
      }}
    </SettingCard>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold tracking-[0.12em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
