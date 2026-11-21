'use client';

import type { ProductSource } from '@as/contracts';
import { useId } from 'react';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { OrderedPicker } from '@/components/ui/ordered-picker';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { SOURCE_LABELS } from '../sections';

export interface SectionLookups {
  categories: readonly { value: string; label: string }[];
  collections: readonly { value: string; label: string }[];
}

type Settings = Record<string, unknown>;

/** Settings forms of the structured section types (settings are kept as the API stores them). */
export function SectionSettings({
  type,
  settings,
  onChange,
  lookups,
  errors,
}: {
  type: string;
  settings: Settings;
  onChange: (settings: Settings) => void;
  lookups: SectionLookups;
  /** API messages by setting name (`title`, `source`, `tabs`…). */
  errors: Record<string, string>;
}) {
  const id = useId();
  const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });
  const text = (key: string) =>
    typeof settings[key] === 'string' ? (settings[key] as string) : '';
  const num = (key: string) => (typeof settings[key] === 'number' ? (settings[key] as number) : '');
  const slugs = (key: string) =>
    Array.isArray(settings[key]) ? (settings[key] as unknown[]).map(String) : [];

  const heading = (
    <>
      <Field id={`${id}-title`} label="Heading" error={errors.title} required>
        {(control) => (
          <Input
            {...control}
            value={text('title')}
            onChange={(event) => set('title', event.target.value)}
            maxLength={120}
          />
        )}
      </Field>
      <Field id={`${id}-subtitle`} label="Line under the heading" error={errors.subtitle}>
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            value={text('subtitle')}
            onChange={(event) =>
              set('subtitle', event.target.value ? event.target.value : undefined)
            }
            maxLength={300}
          />
        )}
      </Field>
    </>
  );

  const limit = (max: number, label = 'How many products') => (
    <Field
      id={`${id}-limit`}
      label={label}
      hint={`1 to ${String(max)}.`}
      error={errors.limit}
      required
    >
      {(control) => (
        <Input
          {...control}
          inputMode="numeric"
          value={num('limit')}
          onChange={(event) => {
            const n = Number(event.target.value);
            set('limit', event.target.value === '' || Number.isNaN(n) ? event.target.value : n);
          }}
          className="sm:max-w-32"
        />
      )}
    </Field>
  );

  switch (type) {
    case 'category-grid':
      return (
        <OrderedPicker
          label="Categories"
          options={lookups.categories}
          value={slugs('categorySlugs')}
          onChange={(value) => set('categorySlugs', value)}
          max={24}
          emptyText="No categories chosen: the tiles stay empty."
          error={errors.categorySlugs}
        />
      );
    case 'collection-grid':
      return (
        <>
          {heading}
          <OrderedPicker
            label="Collections"
            options={lookups.collections}
            value={slugs('collectionSlugs')}
            onChange={(value) => set('collectionSlugs', value)}
            max={24}
            emptyText="No collections chosen."
            error={errors.collectionSlugs}
          />
        </>
      );
    case 'product-carousel':
    case 'product-tabs': {
      const cta = settings.cta as { label?: string; href?: string } | undefined;
      const tabs = Array.isArray(settings.tabs)
        ? (settings.tabs as { categorySlug: string }[]).map((t) => t.categorySlug)
        : [];
      return (
        <>
          {heading}
          <SourceField
            value={settings.source as ProductSource | undefined}
            onChange={(source) => set('source', source)}
            lookups={lookups}
            error={errors.source}
          />
          {type === 'product-tabs' ? (
            <OrderedPicker
              label="Tabs (one per category)"
              options={lookups.categories}
              value={tabs}
              onChange={(value) =>
                set(
                  'tabs',
                  value.map((categorySlug) => ({ categorySlug })),
                )
              }
              max={8}
              emptyText="Add at least one tab."
              error={errors.tabs}
            />
          ) : null}
          {limit(24)}
          {type === 'product-carousel' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={`${id}-cta-label`}
                label="Button text"
                hint="Optional, e.g. “View all”."
                error={errors.cta}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={cta?.label ?? ''}
                    onChange={(event) => {
                      const label = event.target.value;
                      set('cta', label || cta?.href ? { label, href: cta?.href ?? '' } : undefined);
                    }}
                    maxLength={80}
                  />
                )}
              </Field>
              <Field id={`${id}-cta-href`} label="Button link" hint="e.g. /shop?sort=newest">
                {(control) => (
                  <Input
                    {...control}
                    value={cta?.href ?? ''}
                    onChange={(event) => {
                      const href = event.target.value;
                      set(
                        'cta',
                        href || cta?.label ? { label: cta?.label ?? '', href } : undefined,
                      );
                    }}
                    maxLength={500}
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>
          ) : null}
        </>
      );
    }
    case 'recently-viewed':
      return (
        <Field
          id={`${id}-min`}
          label="Show after this many viewed products"
          hint="1 to 12."
          error={errors.minItems}
          required
        >
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={num('minItems')}
              onChange={(event) => {
                const n = Number(event.target.value);
                set(
                  'minItems',
                  event.target.value === '' || Number.isNaN(n) ? event.target.value : n,
                );
              }}
              className="sm:max-w-32"
            />
          )}
        </Field>
      );
    case 'testimonials':
      return (
        <>
          <Field id={`${id}-title`} label="Heading" error={errors.title} required>
            {(control) => (
              <Input
                {...control}
                value={text('title')}
                onChange={(event) => set('title', event.target.value)}
                maxLength={120}
              />
            )}
          </Field>
          {limit(12, 'How many reviews')}
        </>
      );
    default:
      return null;
  }
}

/** Which products a carousel or tab row shows. */
function SourceField({
  value,
  onChange,
  lookups,
  error,
}: {
  value: ProductSource | undefined;
  onChange: (source: ProductSource) => void;
  lookups: SectionLookups;
  error?: string | undefined;
}) {
  const id = useId();
  const kind = value?.kind ?? 'newest';
  const slug = value && 'slug' in value ? value.slug : '';
  const choices = kind === 'collection' ? lookups.collections : lookups.categories;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${id}-kind`} label="Products" error={error} required>
        {(control) => (
          <Select
            {...control}
            value={kind}
            onChange={(event) => {
              const next = event.target.value as ProductSource['kind'];
              if (next === 'collection' || next === 'category') {
                const first = (next === 'collection' ? lookups.collections : lookups.categories)[0];
                onChange({ kind: next, slug: first?.value ?? '' });
              } else {
                onChange({ kind: next });
              }
            }}
          >
            {(Object.keys(SOURCE_LABELS) as ProductSource['kind'][]).map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABELS[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {kind === 'collection' || kind === 'category' ? (
        <Field id={`${id}-slug`} label={kind === 'collection' ? 'Collection' : 'Category'} required>
          {(control) => (
            <Select
              {...control}
              value={slug}
              onChange={(event) => onChange({ kind, slug: event.target.value })}
            >
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </div>
  );
}
