'use client';

import type { AdminSettingDto, StoreSettingKey, StoreSettingValues } from '@as/contracts';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SaveState } from '@/lib/action-state';
import { formatDateTime } from '@/lib/format';

import { saveSetting } from '../actions';

export interface SettingFormProps<V> {
  value: V;
  onChange: (value: V) => void;
  /** Messages by path inside the setting (`fee`, `fields.0.value`…). */
  errors: Record<string, string>;
}

/**
 * One store setting: its form, a save button, who changed it last. The form works on a draft;
 * `toValue` turns the draft into the stored value (or names the field that can't be read).
 */
export function SettingCard<K extends StoreSettingKey, D>({
  setting,
  title,
  description,
  initial,
  toValue,
  canWrite,
  children,
}: {
  setting: AdminSettingDto<K>;
  title: string;
  description: string;
  /** The draft to start from (built from the stored value). */
  initial: D;
  toValue: (draft: D) => { value: StoreSettingValues[K] } | { errors: Record<string, string> };
  canWrite: boolean;
  children: (form: SettingFormProps<D>) => ReactNode;
}) {
  const [draft, setDraft] = useState<D>(initial);
  const [result, setResult] = useState<SaveState>({});
  const [local, setLocal] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const errors = { ...(result.errors ?? {}), ...local };

  const save = () => {
    const converted = toValue(draft);
    if ('errors' in converted) {
      setLocal(converted.errors);
      setResult({ error: 'Some fields need attention.', at: Date.now() });
      return;
    }
    setLocal({});
    start(async () => {
      const next = await saveSetting(setting.key, setting.updatedAt, converted.value);
      setResult(next);
      if (next.done) toast.success(next.done);
    });
  };

  const unplaced = Object.entries(result.errors ?? {}).filter(([path]) => path === '');

  return (
    <Card className="flex flex-col gap-4 p-5" aria-labelledby={`setting-${setting.key}`}>
      <div className="flex flex-col gap-0.5">
        <h2 id={`setting-${setting.key}`} className="text-[16px] font-semibold">
          {title}
        </h2>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      {!setting.valid && setting.value !== null ? (
        <Alert tone="error">
          The saved value breaks the shop’s rules, so the shop is ignoring it. Fix and save it.
        </Alert>
      ) : null}
      {result.stale ? (
        <Alert tone="error">
          Someone else saved this setting meanwhile. Reload the page to see their version.
        </Alert>
      ) : result.error && result.at ? (
        <Alert tone="error">
          {result.error}
          {unplaced.length ? ` ${unplaced.map(([, m]) => m).join(' ')}` : ''}
        </Alert>
      ) : null}
      <fieldset disabled={!canWrite} className="flex flex-col gap-4">
        {children({ value: draft, onChange: setDraft, errors })}
      </fieldset>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-muted">
          {setting.updatedAt
            ? `Last changed ${formatDateTime(setting.updatedAt)}${setting.updatedBy ? ` by ${setting.updatedBy.name}` : ''}`
            : 'Not saved yet'}
        </p>
        {canWrite ? (
          <div className="flex gap-2">
            {dirty ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(initial);
                  setLocal({});
                  setResult({});
                }}
                disabled={pending}
              >
                Undo
              </Button>
            ) : null}
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? 'Saving…' : `Save ${title.toLowerCase()}`}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
