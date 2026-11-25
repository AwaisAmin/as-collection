'use client';

import type { AdminSectionDto, SectionType } from '@as/contracts';
import { startTransition, useActionState, useId, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SaveState } from '@/lib/action-state';
import { fromPktInput, toPktInput } from '@/lib/format';

import { saveSection } from '../actions';
import { defaultSettings, isKnownType, SECTION_TYPES } from '../sections';
import { type RichContext, RichSettings } from './rich-settings';
import { type SectionLookups, SectionSettings } from './section-settings';

const RICH_TYPES = new Set(['sale-banner', 'brand-story', 'instagram-gallery', 'shop-the-look']);

/** API paths under `settings.` → the setting's name; anything else stays as is. */
function splitErrors(errors: Record<string, string> | undefined) {
  const settings: Record<string, string> = {};
  const other: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors ?? {})) {
    const [head, key] = path.split('.');
    if (head === 'settings' && key) settings[key] ??= message;
    else other[path] = message;
  }
  return { settings, other };
}

/**
 * Add a section (choose its type) or edit one: its settings, whether it shows, and an optional
 * schedule in Pakistan time.
 */
export function SectionDialog({
  pageId,
  section,
  addableTypes,
  lookups,
  context,
  onClose,
}: {
  pageId: string;
  /** null: add a new section. */
  section: AdminSectionDto | null;
  addableTypes: readonly SectionType[];
  lookups: SectionLookups;
  context: RichContext;
  onClose: () => void;
}) {
  const id = useId();
  const [type, setType] = useState<string>(section?.type ?? addableTypes[0] ?? 'product-carousel');
  const [settings, setSettings] = useState<Record<string, unknown>>(
    () => section?.settings ?? defaultSettings(type as SectionType),
  );
  const [json, setJson] = useState(() => JSON.stringify(section?.settings ?? {}, null, 2));
  const [isVisible, setVisible] = useState(section?.isVisible ?? true);
  const [startsAt, setStartsAt] = useState(toPktInput(section?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toPktInput(section?.endsAt ?? null));
  const [local, setLocal] = useState<string | null>(null);

  const meta = isKnownType(type) ? SECTION_TYPES[type] : null;
  const advanced = meta?.editor === 'advanced' || !meta;

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const result = await saveSection(pageId, section?.id ?? null, prev, data);
    if (result.done) {
      toast.success(result.done);
      onClose();
    }
    return result;
  }, {});
  const errors = splitErrors(state.errors);

  const submit = () => {
    let finalSettings = settings;
    if (advanced) {
      try {
        const parsed: unknown = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        finalSettings = parsed as Record<string, unknown>;
      } catch {
        setLocal('The settings are not valid JSON.');
        return;
      }
    }
    const starts = startsAt ? fromPktInput(startsAt) : null;
    const ends = endsAt ? fromPktInput(endsAt) : null;
    if ((startsAt && !starts) || (endsAt && !ends)) {
      setLocal('Enter full dates and times, or leave them empty.');
      return;
    }
    if (starts && ends && ends <= starts) {
      setLocal('The end must be after the start.');
      return;
    }
    setLocal(null);
    const payload = {
      ...(section ? { updatedAt: section.updatedAt } : { type }),
      settings: finalSettings,
      isVisible,
      startsAt: starts,
      endsAt: ends,
    };
    const data = new FormData();
    data.set('payload', JSON.stringify(payload));
    startTransition(() => action(data));
  };

  const otherErrors = Object.values(errors.other);
  const settingsErrorsUnplaced =
    advanced || meta?.editor === 'none' ? Object.entries(errors.settings) : [];

  return (
    <Dialog
      open
      onClose={onClose}
      title={section ? `Edit ${meta?.label ?? section.type}` : 'Add a section'}
      description={meta?.description}
      className="max-w-2xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        {state.stale ? (
          <Alert tone="error">
            Someone else changed this section meanwhile. Close this, reload the page and edit again.
          </Alert>
        ) : state.error && state.at ? (
          <Alert tone="error">
            <p>{state.error}</p>
            {otherErrors.length || settingsErrorsUnplaced.length ? (
              <ul className="list-disc pl-5 text-[13px]">
                {otherErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {settingsErrorsUnplaced.map(([key, message]) => (
                  <li key={key}>
                    {key}: {message}
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {local ? <Alert tone="error">{local}</Alert> : null}

        {section ? null : (
          <Field id={`${id}-type`} label="Type">
            {(control) => (
              <Select
                {...control}
                value={type}
                onChange={(event) => {
                  const next = event.target.value as SectionType;
                  setType(next);
                  setSettings(defaultSettings(next));
                }}
              >
                {addableTypes.map((t) => (
                  <option key={t} value={t}>
                    {SECTION_TYPES[t].label} — {SECTION_TYPES[t].description}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {advanced ? (
          <Field
            id={`${id}-json`}
            label="Settings (JSON)"
            hint="Checked by the shop’s rules when you save. This type is newer than this admin, so it is edited as JSON."
          >
            {(control) => (
              <Textarea
                {...control}
                rows={14}
                value={json}
                onChange={(event) => setJson(event.target.value)}
                className="font-mono text-[12px]"
                spellCheck={false}
              />
            )}
          </Field>
        ) : meta?.editor === 'none' ? (
          <p className="bg-canvas rounded-lg px-3 py-2 text-[14px] text-muted">
            {type === 'trust-bar'
              ? 'Its promises are edited in Settings. Here you choose where it sits and when it shows.'
              : 'Nothing to set here. Choose where it sits and when it shows.'}
          </p>
        ) : RICH_TYPES.has(type) ? (
          <RichSettings
            type={type}
            settings={settings}
            onChange={setSettings}
            errors={errors.settings}
            context={context}
          />
        ) : (
          <SectionSettings
            type={type}
            settings={settings}
            onChange={setSettings}
            lookups={lookups}
            errors={errors.settings}
          />
        )}

        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <Checkbox
            label="Shown in the shop"
            checked={isVisible}
            onChange={(event) => setVisible(event.target.checked)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={`${id}-starts`}
              label="From"
              hint="Optional, Pakistan time."
              error={errors.other.startsAt}
            >
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              )}
            </Field>
            <Field id={`${id}-ends`} label="Until" hint="Optional." error={errors.other.endsAt}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : section ? 'Save section' : 'Add section'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
