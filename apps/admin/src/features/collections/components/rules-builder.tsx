'use client';

import type { AdminAttributeDto, CollectionPreviewDto } from '@as/contracts';
import { Eye, ImageOff, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import { previewRules } from '../actions';
import {
  type DraftRule,
  type DraftRules,
  emptyRule,
  RULE_KINDS,
  type RuleKind,
  rulesPayload,
} from '../rules';

/** Conditions for an automated collection, with a dry run of what they match. */
export function RulesBuilder({
  value,
  onChange,
  attributes,
  problems,
}: {
  value: DraftRules;
  onChange: (value: DraftRules) => void;
  /** Choice attributes (rules match their value slugs). */
  attributes: readonly AdminAttributeDto[];
  /** Messages per incomplete row (shown after a save attempt). */
  problems: Record<string, string>;
}) {
  const [preview, setPreview] = useState<CollectionPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (index: number, change: Partial<DraftRule>) => {
    onChange({
      ...value,
      rules: value.rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)),
    });
    setPreview(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-wrap items-center gap-2 text-[14px]">
        Products that match
        <Select
          value={value.match}
          onChange={(event) => {
            onChange({ ...value, match: event.target.value as DraftRules['match'] });
            setPreview(null);
          }}
          className="w-44"
          aria-label="How rules combine"
        >
          <option value="all">all of these</option>
          <option value="any">any of these</option>
        </Select>
      </label>

      <ol className="flex flex-col gap-2">
        {value.rules.map((rule, index) => {
          const attribute = attributes.find((a) => a.code === rule.code);
          const problem = problems[rule.key];
          return (
            <li
              key={rule.key}
              aria-label={`Rule ${String(index + 1)}`}
              className={cn(
                'border-line flex flex-col gap-2 rounded-lg border p-3',
                problem && 'border-danger/40',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={rule.kind}
                  onChange={(event) =>
                    update(index, { ...emptyRule(event.target.value as RuleKind), key: rule.key })
                  }
                  className="w-48"
                  aria-label="Condition"
                >
                  {(Object.keys(RULE_KINDS) as RuleKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {RULE_KINDS[kind]}
                    </option>
                  ))}
                </Select>

                {rule.kind === 'onSale' || rule.kind === 'inStock' || rule.kind === 'featured' ? (
                  <Select
                    value={rule.yes ? 'yes' : 'no'}
                    onChange={(event) => update(index, { yes: event.target.value === 'yes' })}
                    className="w-28"
                    aria-label="Yes or no"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                ) : null}

                {rule.kind === 'tag' ? (
                  <Input
                    value={rule.tags}
                    onChange={(event) => update(index, { tags: event.target.value })}
                    placeholder="eid, wedding"
                    aria-label="Tags (comma separated)"
                    className="min-w-0 flex-1"
                  />
                ) : null}

                {rule.kind === 'priceMax' || rule.kind === 'priceMin' ? (
                  <span className="flex items-center gap-2 text-[14px]">
                    Rs
                    <Input
                      value={rule.rupees}
                      onChange={(event) => update(index, { rupees: event.target.value })}
                      inputMode="decimal"
                      aria-label="Price in rupees"
                      className="w-32"
                    />
                  </span>
                ) : null}

                {rule.kind === 'newWithin' ? (
                  <span className="flex items-center gap-2 text-[14px]">
                    <Input
                      value={rule.days}
                      onChange={(event) => update(index, { days: event.target.value })}
                      inputMode="numeric"
                      aria-label="Days"
                      className="w-20"
                    />
                    days
                  </span>
                ) : null}

                {rule.kind === 'attribute' ? (
                  <Select
                    value={rule.code}
                    onChange={(event) => update(index, { code: event.target.value, values: [] })}
                    className="w-48"
                    aria-label="Detail"
                  >
                    <option value="">Choose…</option>
                    {attributes.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) });
                    setPreview(null);
                  }}
                  disabled={value.rules.length === 1}
                  className="hover:bg-canvas hover:text-danger ml-auto inline-flex size-9 items-center justify-center rounded-lg text-muted disabled:opacity-30"
                  title="Remove rule"
                >
                  <Trash2 aria-hidden size={15} />
                  <span className="sr-only">Remove rule {index + 1}</span>
                </button>
              </div>

              {rule.kind === 'attribute' && attribute ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={attribute.name}>
                  {attribute.values.map((v) => {
                    const on = rule.values.includes(v.value);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(index, {
                            values: on
                              ? rule.values.filter((x) => x !== v.value)
                              : [...rule.values, v.value],
                          })
                        }
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px]',
                          on
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-surface hover:bg-canvas',
                        )}
                      >
                        {v.swatch ? (
                          <span
                            aria-hidden
                            className="border-line size-3 rounded-full border"
                            style={{ background: v.swatch }}
                          />
                        ) : null}
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {problem ? <p className="text-danger text-[13px]">{problem}</p> : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={value.rules.length >= 20}
          onClick={() => onChange({ ...value, rules: [...value.rules, emptyRule()] })}
        >
          <Plus aria-hidden size={15} />
          Add rule
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const { rules } = rulesPayload(value);
              const result = await previewRules(rules);
              if (result.ok) {
                setPreview(result.preview);
                setPreviewError(null);
              } else {
                setPreview(null);
                setPreviewError(result.error);
              }
            })
          }
        >
          <Eye aria-hidden size={15} />
          {pending ? 'Checking…' : 'Preview matches'}
        </Button>
      </div>

      {previewError ? <Alert tone="error">{previewError}</Alert> : null}
      {preview ? (
        <div className="bg-canvas flex flex-col gap-3 rounded-lg p-3" aria-live="polite">
          <p className="text-[14px] font-medium">
            {preview.count === 0
              ? 'No live products match right now.'
              : `${String(preview.count)} live ${preview.count === 1 ? 'product matches' : 'products match'} right now.`}
          </p>
          {preview.sample.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {preview.sample.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 text-[12px]">
                  <span className="border-line bg-surface flex aspect-square items-center justify-center overflow-hidden rounded-md border">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                      <img src={p.image.url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff aria-hidden size={16} className="text-muted" />
                    )}
                  </span>
                  <span className="line-clamp-2">{p.name}</span>
                  {p.priceMinMinor !== null ? (
                    <span className="text-muted">{formatMoney(p.priceMinMinor)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
